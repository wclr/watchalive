var express = require('express'),
    http = require('http'),
    fs = require('fs'),
    path = require('path'),
    async = require('async'),
    onHeaders = require('on-headers'),
    colors = require('colors'),
    favicon = require('serve-favicon'),
    less = require('less')

colors.setTheme({
    info: 'green',
    util: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

var cwd = process.cwd()

var statServer = function(options){

    console.log('Starting WATCHALIVE...'.info)

    var config = {
        port: 7000,
        base: cwd,
        clientLibName: 'watchalive.js',
        poolInterval: 200,
        watchChangeTimeout: 100,
        injectScript: true,
        favicon: 'favicon.png',
        less: {}
    }

    var log = function(){
        if (config.debug){
            console.log.apply(console, arguments)
        }
    }

    for (var prop in options){
        if (options[prop] !== undefined) {
            config[prop] = options[prop]    
        }
    }
    if (options.base){
        config.base = path.resolve(cwd, options.base)
    }

    if (config.less.paths){
        config.less.paths = config.less.paths.map(function(p){path.resolve(config.base, p)})
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

        var full = path.resolve(config.base, mask[1] == '/' ? mask.slice(1) : mask)
                .replace(/\\/g, '\\\\'), // for windows paths
            regEx = new RegExp('^' + full.replace(/\*/g, '.*' ) + '$' )
        return !!filepath.match(regEx)
    }

    var cleanWatchers = function(){
        filesToWatch.forEach(function(file){
            fs.unwatchFile(file)
        })
        clients = []
        filesToWatch = []
        fileCache = {}
        lessCssMap = {}
        lessImportsDeps = {}
    }

    var addToWatcher = function(filepath){

        var changed = [], changeTimeout

        if (filesToWatch.indexOf(filepath) === -1){

            fs.watchFile(filepath, {interval: config.poolInterval}, function(cur){

                setTimeout(function(){

                    if (changed.indexOf(filepath) === -1){
                        changed.push(filepath)
                        clearTimeout(changeTimeout)

                        changeTimeout = setTimeout(function(){

                            var changedFiles = changed

                            // clear changed for next queue
                            changed = []

                            // put changed files to cache
                            async.map(changedFiles, function(filePath, cb){

                                fs.readFile(filePath, 'utf8', function(err, data) {
                                    if (err) {
                                        console.log('Error reading file'.error, filePath)
                                    }
                                    if (data){
                                        addToFileCache(filePath, data)
                                    }
                                    cb(err)
                                })

                            }, function(err){
                                if (err){
                                    return
                                }

                                var allowedFiles = changedFiles.filter(function(file){
                                    return file.match(/\.(css|less)$/)
                                })

                                //console.log('allowedFiles', allowedFiles)

                                if (allowedFiles.length !== changedFiles.length){
                                    clients.forEach(function(client){
                                        client.socket.emit('reload')
                                        cleanWatchers()
                                    })
                                } else {

                                    var filesToSend = []

                                    allowedFiles.forEach(function(file){
                                        // check less imports
                                        var deps = lessImportsDeps[file]
                                        if (deps) {
                                            deps.forEach(function(dep){
                                                if (filesToSend.indexOf(dep) < 0) filesToSend.push(dep)
                                            })
                                        } else {
                                            filesToSend.push(file)
                                        }
                                    })
                                    //console.log('filesToSend', filesToSend)

                                    var dataToSend = []

                                    async.map(filesToSend, function(filename, cb){

                                        var data = fileCache[filename]

                                        if (!data){
                                            console.log('No data in file cache for'.error, filename)
                                        }

                                        // check if file is mapped *.less
                                        var mappedCssFilePath = lessCssMap[filename]
                                        if (mappedCssFilePath){
                                            parseLess(filename, data, function(err, cssData){
                                                if (err) return cb(err)
                                                if (fileCache[mappedCssFilePath] !== cssData){
                                                    addToFileCache(mappedCssFilePath, cssData)
                                                    console.log('Sending changed data for mapped less/css', mappedCssFilePath)
                                                    dataToSend.push({file: getServedFileName(mappedCssFilePath), data: cssData})
                                                }
                                                cb()
                                            })
                                        } else {
                                            dataToSend.push({file: getServedFileName(filename), data: data})
                                            cb()
                                        }
                                    }, function(err){
                                        if (!err) {
                                            clients.forEach(function(client){
                                                client.socket.emit('files', dataToSend)
                                            })
                                        }
                                    })
                                }

                            })
                        }, config.watchChangeTimeout)
                        console.log('file changed', filepath)
                    }

                })
            })
            filesToWatch.push(filepath)
        }
    }

    var isSkipped = function(filePath){
        var skipWatch = false
        if (config.skip){
            config.skip.every(function(s){
                return !(skipWatch = checkMaskMatch(filePath, s))
            })
        }
        return skipWatch
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
        } else {
            console.log('Allow cache for', filepath)
        }

        if (isSkipped(filepath)){
            return
        }

        addToWatcher(filepath)
    }


    //app.get('*', function(req, res, next){
    //    console.log('Requested', req.url)
    //    next()
    //})


    app.get('/' + config.clientLibName, serveClientJs)


    if (config.proxies){

        var httpProxy = require('http-proxy')

        //var proxy = httpProxy.createProxyServer()
        var proxy = httpProxy.createServer()

        proxy.on('proxyReq', function(proxyReq, req, res, options) {
            //proxyReq.setHeader('X-Special-Proxy-Header', 'foobar');
            console.log('proxyReq', proxyReq)
        });

        proxy.on('proxyRes', function(proxyRes, req, res, options) {
            //proxyReq.setHeader('X-Special-Proxy-Header', 'foobar');
            console.log('proxyRes', proxyRes)
        });

        config.proxies.forEach(function(config){

            var target = config.target || (config.protocol || 'http') + '://' + (config.host || 'localhost') + ':' + (config.port || '80')

            console.log(colors.util('Proxy requests %s to %s'), config.context, target)

            app.all(config.context + '/*', function(req, res){
                req.host = target.replace('^http(s)?://', '')
                console.log('proxy request', req.url, 'host', req.host)
                proxy.web(req, res, { target: target, changeOrigin: true}, function(err){
                    res.status(502).send(err)
                });
            });
        })
    }

    if (config.routes){
        config.routes.forEach(function(route) {

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
                            injectScript(req.url + 'index.html', res, next)
                            return
                        } else if (req.url.slice(-5) == '.html') {
                            injectScript(req.url, res, next)
                            return
                        }
                    }
                    next()
                })
            }

            var url
            if (route.path && route.target) {
                //url = typeof route.regexp == 'string' ? new RegExp(route.path, route.regexp) : route.path
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


    var injectScript = function(url, res, next){
        var filePath = path.resolve(config.base, url.slice(1))
        //console.log('Injecting script in config.base', config.base, url, filePath)
        fs.readFile(filePath, 'utf8', function(err, data){
            if (err){
                next()
            } else {
                addToWatcher(filePath)
                // check if script is already there
                if (!data.match(new RegExp('<script([^<>])+' + config.clientLibName + '([^<>])+>', 'i'))){
                    data = data.replace(/(<head>)(\s*)/, '$1$2<script src="/' + config.clientLibName + '"></script>$2')
                    //data = data.replace(/(\s*)(<\/head>)/, '<script src="/' + config.clientLibName + '"></script>$1$2')
                    console.log('Watchalive client script injected in', url)
                }

                res.send(data)
            }

        })
    }

    app.get(/.less$/, function(req, res, next){
        var filePath = path.resolve(config.base, req.url.slice(1))
        fs.readFile(filePath, 'utf8', function(err, data){
            if (err){
                console.log(err)
                next()
            } else {
                data = data.
                    replace(/\/\/.*/g, '') // remove inline comments (two slashes)
                    .replace(/\n/g ,'') // remove line breaks
                    .replace(/\/\*.*?\*\//g, '') // remove standard comments (/* */)
                if (config.debug) {
                    console.log('Serve clean less/css', req.url)
                }
                addToWatcher(filePath)
                res.send(data)
            }

        })
    })

    var fileCache = {}

    // adds file to cache and converts it as nesessary
    var addToFileCache = function(filePath, source){

        if (filePath.match(/\.js$/)){
            source = source
                .replace(/\.less!\$less/g, '.css!$css')
                .replace(/\.less!/g, '.css!')
        }

        fileCache[filePath] = source

        return source
    }


    var lessImportsDeps = {}
    var lessCssMap = {}

    var parseLess = function(filePath, source, callback){

        //var match = new RegExp('@import\\s+(\'|")' + cachedUrl + '(\\.less)?(\'|")' )
        //var imports = source.match(/@import\s('|":?)(.*)('|":?)/g)

        var parser = new less.Parser({
            paths: ([] || config.less.paths).concat([path.dirname(filePath), config.base])
        })

        try {

            parser.parse(source, function (err, tree) {
                if (err) {
                    console.error('error', err)
                    callback(err)
                    return
                }
                //console.log(tree);
                tree.rules.forEach(function(rule){
                    var imported = rule.importedFilename
                    if (imported) {
                        // less import dependencies
                        var deps = lessImportsDeps[imported] || []
                        if (deps.indexOf(filePath) < 0){
                            deps.push(filePath)
                        }
                        lessImportsDeps[imported] = deps
                        addToWatcher(imported)
                    }
                })

                addToWatcher(filePath)

                callback(null, tree.toCSS())

            });
        } catch(e){
            Console.log('Exception while parsing less', filePath, e)
            callback(e)
        }


    }

    app.get(/.css$/, function(req, res, next){
        var filePath = path.resolve(config.base, req.url.slice(1))

        if (fileCache[filePath]){
            sendFileData(res, fileCache[filePath], 'text/css')
            if (!lessCssMap[filePath]){
                addToWatcher(filePath)
            }
        } else {
            var lessFilePath = filePath.replace(/.css$/, '.less')

            fs.readFile(lessFilePath, 'utf8', function(err, data){
                if (data){
                    lessCssMap[lessFilePath] = filePath
                    addToFileCache(lessFilePath, data)
                    parseLess(lessFilePath, data, function(err, cssData){
                        addToFileCache(filePath, cssData)
                        if (err){
                            console.log('Error parsing less file', lessFilePath, err)
                            res.status(500).send(err)
                        } else {
                            sendFileData(res, cssData, 'text/css')
                        }
                    })
                } else {
                    next()
                }
            })
        }
    })

    var sendFileData = function(res, data, contentType){
        if (contentType){
            res.setHeader('Content-Type', contentType)
        }
        res.write(data)
        res.end()
    }

    app.get(/\.js$/, function(req, res, next){
        var filePath = path.resolve(config.base, req.url.slice(1))

        if (fileCache[filePath]){
            sendFileData(res, fileCache[filePath], 'text/javascript')
            addToWatcher(filePath)
        } else {
            fs.readFile(filePath, 'utf8', function(err, data){
                if (data){
                    if (!isSkipped(filePath)){
                        data = addToFileCache(filePath, data)
                        addToWatcher(filePath)
                    }
                    sendFileData(res, data, 'text/javascript')
                } else {
                    res.status(500).send(err)
                }

            })
        }
    })

    if (fs.existsSync(path.resolve(config.base, config.favicon))){
        app.use(favicon(path.resolve(config.base, config.favicon)))
    }

    app.get(/less-\d\.\d\.\d\.js/, function(req, res, next){
        var filePath = path.resolve(config.base, req.url.slice(1))
        console.log('less engline request', req.url)
        fs.readFile(filePath, 'utf8', function(err, data){
            if (err){
                console.log(err)
                next()
            } else {
                // check if script is already there
                data = data.replace(/(var fileCache = \{\};)/, '$1less.fileCache = fileCache;')
                console.log('Less engine fileCache access injected in', req.url)
                res.send(data)
            }

        })
    })

    app.get(/steal\/less\.js$/, function(req, res, next){
        console.log('Replace less.js (sysmemjs plugin)')
        res.sendFile(__dirname + '/less.js')
    })

    //app.get('*', function(req, res, next){
    //    console.log('route', req.url)
    //    next()
    //})

    if (config.injectScript){

        // check if index.html here for route: /{something without dot}
        app.get(/\/[^.]*$/, function(req, res, next){
            injectScript(req.url + (req.url.slice(-1) !== '/' ? '/' : '') + 'index.html', res, next)
        })

        app.get('*.html', function(req, res, next){
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
