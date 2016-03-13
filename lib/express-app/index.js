'use strict'

var express = require('express'),
  http = require('http'),
  url = require('url'),
  session = require('express-session'),
  favicon = require('serve-favicon'),
  colors = require('colors'),
  util = require('util')

var bundleFiles = require('./bundle-files')

var fs = require('fs'),
  path = require('path')

var ExpressApp = function(config){

  var self = this
  var app = this.app = express()

  var logger = this.logger = config.logger
  this.watchStore = config.watchStore

  if (config.http2){
    http = require('http2')
    config.httpOptions = config.httpOptions || {}
    config.httpOptions.cert = fs.readFileSync(__dirname +  '/cert/localhost.cert')
    config.httpOptions.key = fs.readFileSync(__dirname +  '/cert/localhost.key')
  }

  var args = config.httpOptions ? [config.httpOptions, app] : [app]
  var server = this.server = http.createServer.apply(http, args)

  this.config = config

  this.sessionMiddleware = session({
    key: 'watchalive.sid',
    secret: 'WOW',
    cookie: {},
    saveUninitialized: true,
    resave: true
  })

  //var appCookieParser = cookieParser()
  //this.exp.use(appCookieParser);
  app.use(this.sessionMiddleware)

  //var iconPath = path.resolve(config.base, config.favicon)
  //if (fs.existsSync(iconPath)){
  //    app.use(favicon(iconPath))
  //}

  app.get('*', (req, res, next) => {
    if (!req.session.client){
      req.session.client = 'client_' + new Date().getTime()
      this.logger.debug('New client session', req.session.client)

    }
    next()
  })

  app.get('*', function(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next()
  })


  var serveClientJs = bundleFiles({files: [this.config.injectSocketIo && 'socket.io.js' ,'client.js'], wrap: true})
  app.get('/' + config.clientLibName, serveClientJs)


  if (config.proxy){

    var httpProxy = require('http-proxy')

    var proxy = httpProxy.createProxyServer()

    config.proxy.forEach(function(config){

      if (typeof config == 'string'){
        let pathname = url.parse(config).pathname || ''
        config = {
          context: pathname,
          target: config.slice(0, config.length - pathname.length)
        }
      } else if (util.isArray(config)){
        config = {context: config[0], target: config[1]}
      } else if (Object.keys(config).length == 1){
        let context = Object.keys(config)[0]
        config = {context: context, target: config[context]}
      }

      if (!config) return

      let target = config.target
        || (config.protocol || 'http') + '://' +
        (config.host || 'localhost') +
        ':' + (config.port || '80')

      if (!/^https?:\/\//.test(target)){
        target = 'http://' + target
      }

      var contexts = []
      if (config.contexts){
        if (util.isArray(config.contexts)){
          contexts = config.contexts
        } else if (typeof config.contexts == 'string') {
          contexts = config.contexts.split(' ')
        }
      }

      var context = config.context || config.regexp || config.r
      if (context){
        contexts.push(context)
      }

      var changeOrigin = true
      if (typeof config.changeOrigin == 'boolean'){
        changeOrigin = config.changeOrigin
      }

      contexts.forEach(function(context){
        let isRegExp = !!config.regexp || !!config.r
          || context instanceof RegExp
        let path = isRegExp
          ? new RegExp(context)
          : context + '/*'
        self.logger.log(`Proxy requests ${path} to ${target}`)
        app.all(path, function(req, res){
          logger.debug('Proxy request:', req.url, '(redirected to', target + ')')
          proxy.web(req, res, { target: target, changeOrigin: changeOrigin}, function(err){
            self.logger.error('Proxy request error for', req.url, err)
            //res.status(502).send(err)
          });
        });
      })
    })
  }


  var injectScript = function(req, res, next){
    var to = config.injectScriptTo || 'body'
    var file = url.parse(req.url).pathname.replace(/^[\/\\]/, '')
    self.watchStore.getFileData(file, function(err, data){
      if (err){
        return next()
      }
      if (!data){
        self.logger.error('injectScript no data', file, 'url', req.url)
        return res.send('')
      }

      //var token = require('crypto').randomBytes(16).toString('hex');
      var token = req.session.client;
      var tagStr = `<meta id="__watchalive_token__" content="${token}"/>`
      self.logger.debug('__watchalive_token__', req.session.client)
      // check if watchalive tag is already present
      if (!data.match(new RegExp('<script([^<>])+' + config.clientLibName + '([^<>])+>', 'i'))){
        tagStr += '<script src="/' + config.clientLibName + '"></script>'
        self.logger.log('Client script injected in', req.url)
      }

      if (tagStr){
        // if insert to tag (body or head) present prepend it
        if (new RegExp('(<' + to + '>)').test(data)){
          data = data.replace(new RegExp('(<' + to + '>)(\\s*)'), '$1$2'+ tagStr +'$2')
        } else {
          // if no head/body tag just prepend to content
          data = tagStr + data
        }
      }

      res.send(data)
    })
  }

  // inject script in *.html files
  if (config.injectScript){
    app.get(/\/[^.]*$/, function(req, res, next){
      var url = path.join(req.url, 'index.html').replace(/\\/g, '/'),
        filePath =  path.join(self.config.base, url)
      fs.exists(filePath, function(exists){
        if (exists) {
          req.url = url
          injectScript(req, res, next)
        } else {
          next()
        }
      })
    })
    app.get('*.html', injectScript)
  }

  app.get('*', (req, res, next) => {
    var file = url.parse(req.url).pathname.slice(1)
    var serveFile = (result) => {
      logger.debug('File served:', req.url, '(' + result.contentType  + ')')
      res.setHeader('Content-Type', result.contentType)
      result.data
        ? res.write(result.data)
        : logger.warn('No file data for', file)
      res.end()
    }
    !file ? next() : self.watchStore.getFile(file, (err, result) => {
      result ? serveFile(result) : next()
    }).catch(next)
  })

  var staticDirs = [config.base]

  staticDirs.forEach((dir) => {
    self.logger.log('Serve static on', dir)
    app.use(express.static(dir, {}))
  })

  app.get('*', (req, res, next) => {
    var file = url.parse(req.url).pathname.slice(1)
    !this.config.filesFallthrough && path.extname(file)
      ? res.send(404)
      : next()
  })

  if (config.route) {
    config.route.forEach(function(route) {
      var createRoute = function(url, target){
        self.logger.log('Route', url, target)
        app.get(url, function (req, res, next) {
          self.logger.debug('Route match', url + ':', req.path, '=>', target)
          // exclude /favicon.ico warning
          if (path.extname(req.url) && url.indexOf('*') >= 0 && req.url !== '/favicon.ico'){
            self.warn('Url matched custom wildcard route', url, 'looks like file:', req.url)
          }
          // handling wildcard
          if (typeof url == 'string' && url.indexOf('*') >= 0 && target.indexOf('*') >= 0){
            var wildcardMatch = req.url.match(new RegExp(url.replace(/\*/, '(.*)')))
            if (wildcardMatch){
              req.url = target.replace(/\*/, wildcardMatch[1])
            }
          } else {
            req.url = target
          }

          // handling :params
          req.url = req.url.replace(/:[\w\d]+/ig, function(param){return req.params[param.slice(1)] || param})

          if (config.injectScript){
            if (req.url.slice(-1) == '/'){
              req.url += 'index.html'
              injectScript(req, res, next)
              return
            } else if (req.url.slice(-5) == '.html') {
              injectScript(req, res, next)
              return
            }
          }
          next()
        })
      }

      var url
      if (route.path && route.target) {
        var regexp = route.regexp ? (typeof route.regexp == 'string' ? route.regexp : '') : route.regexp
        url = typeof regexp == 'string' ? new RegExp(route.path, regexp) : route.path
        //console.log('new route', url, route.target)
        createRoute(url, route.target)
      } else {
        if (util.isArray(route)){
          createRoute(route[0], route[1])
        } else {
          for (url in route) {
            if (typeof route[url] === 'string'){
              createRoute(url, route[url])
            }
          }
        }
      }
    })
  }
}

ExpressApp.prototype = {

  _handlers: [],

  start: function(){
    if (!this.server) return
    this.server.listen(this.config.port);
    this.logger.log("Watchalive", this.config.http2 ? 'HTTP2' : 'HTTP', "server listening on port",  this.config.port)
  },

  stop: function(){

  },

  on: function(handler){
    this._handlers.push(handler)
  },

  emit: function(event, data){
    this._handlers.forEach(function(handler){
      handler(event, data)
    })
  },

  error: function(){
    this.logger.error.apply(this.logger, arguments)
    this.emit('error', Array.prototype.slice.call(arguments).join(' '))
  },

  warn: function(){
    this.logger.warn.apply(this.logger, arguments)
    this.emit('warn', Array.prototype.slice.call(arguments).join(' '))
  }
}

module.exports = ExpressApp