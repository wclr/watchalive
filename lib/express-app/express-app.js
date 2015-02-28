var express = require('express'),
    http = require('http'),
    session = require('express-session'),
    cookieParser = require('cookie-parser'),
    favicon = require('serve-favicon'),
    colors = require('colors')

var bundleFiles = require('./bundle-files')

var fs = require('fs'),
    path = require('path')

var ExpressApp = function(config){

    var self = this
    var app = this.app = express()
    var server = this.server = http.createServer(app)

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

    var iconPath = path.resolve(config.base, config.favicon)
    if (fs.existsSync(iconPath)){
        app.use(favicon(iconPath))
    }

    app.get('*', function(req, res, next){
        !req.session.client && (req.session.client = 'client_' + new Date().getTime())
        next()
    })

    app.get('*', function(req, res, next){
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next()
    })


    var serveClientJs = bundleFiles({files: ['socket.io.js' ,'client.js'], wrap: true})
    app.get('/' + config.clientLibName, serveClientJs)


    if (config.proxy){

        var httpProxy = require('http-proxy')

        var proxy = httpProxy.createProxyServer()

        config.proxy.forEach(function(config){

            var target = config.target || (config.protocol || 'http') + '://' + (config.host || 'localhost') + ':' + (config.port || '80')

            console.log(colors.util('Proxy requests %s to %s'), config.context, target)

            app.all(config.context + '/*', function(req, res){
                proxy.web(req, res, { target: target, changeOrigin: true}, function(err){
                    res.status(502).send(err)
                });
            });
        })
    }

    if (config.route){
        config.route.forEach(function(route) {

            var createRoute = function(url, target){
                //console.log('create route get ', url, target)
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


    var injectScript = function(req, res, next){
        var to = config.injectScriptTo || 'body'
        self.watchStore.getFileData(req.url).then(function(data){
            if (!data.match(new RegExp('<script([^<>])+' + config.clientLibName + '([^<>])+>', 'i'))){
                data = data.replace(new RegExp('(<' + to + '>)(\\s*)'), '$1$2<script src="/' + config.clientLibName + '"></script>$2')
                console.log('Watchalive client script injected in', req.url)
            }
            res.send(data)
        })
    }

    if (config.injectScript){
        app.get(/\/[^.]*$/, injectScript)
        app.get('*.html', injectScript)
    }


    app.get('*', function(req, res, next){
        self.watchStore.getFile(req.url).then(function(file){

            if (!file){return next()}

            res.setHeader('Content-Type', file.contentType)
            res.write(file.data)
            res.end()
        })
    })

    var staticDirs = [config.base]

    staticDirs.forEach(function(dir){
        console.log('Serve static on ', dir)
        app.use(express.static(dir, {}))
    })


}

ExpressApp.prototype = {

    start: function(){
        this.server.listen(this.config.port);
        console.log("Watchalive server listening on port",  this.config.port)
    },

    stop: function(){

    }

}

module.exports = ExpressApp