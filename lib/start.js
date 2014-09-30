var express = require('express'),
    http = require('http'),
    fs = require('fs'),
    path = require('path'),
    async = require('async'),
    onHeaders = require('on-headers')

var cwd = process.cwd()

var statServer = function(options){

    console.log('Starting WATCHALIVE...')

    var config = {
        port: 7000,
        base: cwd,
        clientLibName: 'watchalive.js',
        poolInterval: 200,
        injectScript: true
    }

    for (var prop in options){
        if (options[prop] !== undefined) {
            config[prop] = options[prop]    
        }
    }
    if (options.base){
        config.base = path.resolve(cwd, options.base)
    }

    var app = express()

    var filesToWatch = []

    var server = http.createServer(app)

    var io = require('socket.io')(server)

    var clients = []

    io.on('connection', function (socket) {

        //console.log('connection')
        clients.push({socket: socket})

        socket.emit('connected')

        socket.on('login', function(browserName){
            console.log(browserName + ' connected')
        })

    });

    var staticDirs = [config.base]

    var unsetCacheHeaders = function() {
        //this.removeHeader('Cache-Control')
        this.removeHeader('Etag')
        this.removeHeader('Last-Modified')
        this.setHeader('Cache-Control', 'No-cache')
        this.setHeader('Pragma', 'No-cache')
    }

    var getServedFileName = function(filepath){

        var filename = ''

        staticDirs.every(function(dir){

            var rel = path.relative(dir, filepath)

            if (rel && rel !== filepath && rel.indexOf('..') < 0){
                filename = rel.replace(/\\/g, '/')
                return false
            }
            return true
        })
        return filename
    }


    var serveClientJs = function(req, res){
        res.setHeader('Content-Type', 'text/javascript')

        res.write(';(function(){')
        var files = ['socket.io.js' ,'watchalive.js']

        async.forEachSeries(files, function(file, done){
            file = __dirname + '/../public/' + file
            fs.readFile(file, function(err, data){
                if (err){
                    res.write('// Error reading ' + file + ': ' + err)
                }else{
                    res.write('\n//============== ' + path.basename(file) + ' ==================\n\n')
                    res.write(data)
                }
                done()
            })
        }, function(){
            res.write('}());')
            res.end()
        })
    }


    var checkMaskMatch = function(filepath, mask){
        var full = path.resolve(config.base, mask)
                .replace(/\\/g, '\\\\'), // for windows paths
            regEx = new RegExp('^' + full.replace(/\*/g, '.*' ) + '$' )
        return !!filepath.match(regEx)
    }


    var addToWatcher = function(filepath){

        var changed = [], changeTimeout

        if (filesToWatch.indexOf(filepath) === -1){
            fs.watchFile(filepath, {interval: config.poolInterval}, function(cur){

                setTimeout(function(){
                    //console.log('file changed event')

                    if (changed.indexOf(filepath) === -1){
                        changed.push(filepath)
                    }

                    if (!changeTimeout){
                        //console.log('setTimeout', changeTimeout)
                        changeTimeout = setTimeout(function(){


                            var filesToSend = changed.filter(function(file){
                                return file.match(/\.css$/)
                            })

                            if (filesToSend.length !== changed.length){
                                clients.forEach(function(client){
                                    filesToWatch = []
                                    clients = []
                                    client.socket.emit('reload')

                                })
                            } else {
                                var data  = filesToSend.map(function(filename){
                                    var served = getServedFileName(filename)
                                    console.log('changed served', served)
                                    return {
                                        file: served,
                                        data: fs.readFileSync(filename, 'utf8')
                                    }
                                })
                                clients.forEach(function(client){
                                    client.socket.emit('files', data)
                                })

                            }

                            changeTimeout = null
                            changed = []
                            console.log('file changed', filepath)
                        }, 100)
                    }
                })

            })
            filesToWatch.push(filepath)
        }
    }


    var setHeaders = function(res, filepath){

        var killCache = true

        if (config.allowCache){
            config.allowCache.every(function(allow){
                return (killCache = !checkMaskMatch(filepath, allow))
            })
        }

        if (killCache){
            onHeaders(res, unsetCacheHeaders)
        }

        var skipWatch = false

        if (config.skip){
            config.skip.every(function(s){
                //console.log('check skip', s, filepath, checkMaskMatch(filepath, s))
                return !(skipWatch = checkMaskMatch(filepath, s))
            })
        }

        addToWatcher(filepath)
    }

    app.get('/' + config.clientLibName, serveClientJs)

    var httpProxy = require('http-proxy')

    var proxy = httpProxy.createProxyServer()

    if (config.proxies){
        config.proxies.forEach(function(config){

            var target = config.target || (config.protocol || 'http') + '://' + config.host + ':' + (config.port || '80')

            console.log('Proxy requests', config.context, 'to', target)

            app.all(config.context + '/*', function(req, res){
                proxy.web(req, res, { target: target }, function(err){
                    res.send(502, err)
                });
            });
        })
    }

    var injectScript = function(url, res, next){
        var filePath = path.resolve(config.base, url.slice(1))
        //console.log('Injecting script in config.base', config.base, url, filePath)
        fs.readFile(filePath, 'utf8', function(err, data){
            if (err){
                next()
            } else {
                addToWatcher(filePath)
                data = data.replace(/(<head>)(\s*)/, '$1$2<script src="/' + config.clientLibName + '"></script>$2')
                console.log('Watchalive client script injected in', url)
                res.send(data)
            }

        })
    }

    if (config.routes){
        config.routes.forEach(function(route) {

            var createRoute = function(url, target){
                app.get(url, function (req, res, next) {
                    //console.log('route get ', req.url, route.target)
                    req.url = target

                    if (config.injectScript){
                        if (target.slice(-1) == '/'){
                            injectScript(target + 'index.html', res, next)
                            return
                        } else if (target.slice(-5) == '.html') {
                            injectScript(target, res, next)
                            return
                        }
                    }
                    next()
                })
            }

            var url
            if (route.path && route.target) {
                url = typeof route.regexp == 'string' ? new RegExp(route.path, route.regexp) : route.path
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


    if (config.injectScript){
        //app.get('/', function(req, res, next){
        //    injectScript('/index.html', res, next)
        //})

        // check if index.html here for route: /{something without dot}
        app.get(/\/[^.]*$/, function(req, res, next){
            injectScript(req.url + (req.url.slice(-1) !== '/' ? '/' : '') + 'index.html', res, next)
        })

        app.get('*.html', function(req, res, next){
            console.log('get *.html', res.url)
            injectScript(req.url, res, next)
        })
    }

    staticDirs.forEach(function(dir){
        console.log('Serve static on ', dir)
        app.use(express.static(dir, {
            setHeaders: setHeaders
        }))

    })

    server.listen(config.port);
    console.log("Watchalive server listening on port",  config.port);
}

module.exports = statServer