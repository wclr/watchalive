var express = require('express'),
    http = require('http'),
    url = require('url'),
    session = require('express-session'),
    cookieParser = require('cookie-parser'),
    favicon = require('serve-favicon'),
    colors = require('colors'),
    util = require('util')

var bundleFiles = require('./bundle-files')

var fs = require('fs'),
    path = require('path')

var ExpressApp = function(config){

    var self = this
    var app = this.app = express()
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
        }),
        appCookieParser = cookieParser()

    //this.exp.use(appCookieParser);
    app.use(this.sessionMiddleware)

    //var iconPath = path.resolve(config.base, config.favicon)
    //if (fs.existsSync(iconPath)){
    //    app.use(favicon(iconPath))
    //}

    app.get('*', function(req, res, next){
        !req.session.client && (req.session.client = 'client_' + new Date().getTime())
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

            if (Object.keys(config).length == 1){
                var context = Object.keys(config)[0]
                config = {context: context, target: config[context]}
            }

            var target = config.target || (config.protocol || 'http') + '://' + (config.host || 'localhost') + ':' + (config.port || '80')

            console.log(colors.util('Proxy requests %s to %s'), config.context, target)

            var contexts = []

            if (config.contexts){
                if (util.isArray(config.contexts)){
                    contexts = config.contexts
                } else if (typeof config.contexts == 'string') {
                    contexts = config.contexts.split(' ')
                }
            }
            if (config.context){
                contexts.push(config.context)
            }

            var changeOrigin = true
            if (typeof config.changeOrigin == 'boolean'){
                changeOrigin = config.changeOrigin
            }

            contexts.forEach(function(context){
                app.all(context + '/*', function(req, res){
                    proxy.web(req, res, { target: target, changeOrigin: changeOrigin}, function(err){
                        res.status(502).send(err)
                    });
                });
            })
        })
    }

    var injectScript = function(req, res, next){
        var to = config.injectScriptTo || 'body'
        var file = url.parse(req.url).pathname.slice(1)
        self.watchStore.getFileData(file, function(err, data){
            if (err){
                return next()
            }
            if (!data){
                console.error('not data', file)
                return res.send('')
            }
            if (!data.match(new RegExp('<script([^<>])+' + config.clientLibName + '([^<>])+>', 'i'))){
                data = data.replace(new RegExp('(<' + to + '>)(\\s*)'), '$1$2<script src="/' + config.clientLibName + '"></script>$2')
                console.log('Watchalive client script injected in', req.url)
            }
            res.send(data)
        })
    }



    if (config.injectScript){
        app.get(/\/[^.]*$/, function(req, res, next){

            var url = path.join(req.url, 'index.html').replace(/\\/g, '/'),
                filePath =  path.join(self.config.base, url)
            fs.exists(filePath, function(exists){
                if (exists) {
                    req.url = url
                }
                next()
            })
        }, injectScript)
        app.get('*.html', injectScript)
    }


    app.get('*', function(req, res, next){
        var file = url.parse(req.url).pathname.slice(1)
        self.watchStore.getFile(file, function(err, file){

            if (err || !file){return next()}

            res.setHeader('Content-Type', file.contentType)
            res.write(file.data)
            res.end()
        }).catch(next)
    })

    var staticDirs = [config.base]

    staticDirs.forEach(function(dir){
        console.log('Serve static on ', dir)
        app.use(express.static(dir, {}))
    })


    if (config.route){
        config.route.forEach(function(route) {

            var createRoute = function(url, target){
                console.log('create route get ', url, target)
                app.get(url, function (req, res, next) {

                    //console.log('route get ', req.url, target, req.params)

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
                for (url in route) {
                    if (typeof route[url] == 'string'){
                        createRoute(url, route[url])
                    }
                }
            }
        })
    }
}

ExpressApp.prototype = {

    start: function(){
        if (!this.server) return
        this.server.listen(this.config.port);
        console.log("Watchalive", this.config.http2 ? 'HTTP2' : 'HTTP', "server listening on port",  this.config.port)
    },

    stop: function(){

    }

}

module.exports = ExpressApp