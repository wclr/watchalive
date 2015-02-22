var express = require('express'),
    http = require('http'),
    fs = require('fs'),
    path = require('path'),
    async = require('async'),
    onHeaders = require('on-headers'),
    colors = require('colors'),
    favicon = require('serve-favicon'),
    less = require('less'),
    trycatch = require('trycatch'),
    UAParser = require('ua-parser-js');

var serveFiles = require('./serve-files')

colors.setTheme({
    info: 'green',
    log: 'grey',
    warn: 'yellow',
    error: 'red',
    util: 'grey',
    help: 'cyan',
    debug: 'blue'
})

var consoleEvents = ['log', 'warn', 'info', 'error']

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
    if (typeof options.base == 'string'){
        config.base = path.resolve(cwd, options.base)
    }

    config.less = config.less || {}

    config.less.paths = config.less.paths || []

    config.less.paths = config.less.paths.map(function(p){path.resolve(config.base, p)})

    config.less.paths.push(config.base)

    var app = express()

    var filesToWatch = []

    var server = http.createServer(app)

    var io = require('socket.io')(server)

    var clients = []

    io.on('connection', function (socket) {

        //console.log('connection')

        var client = {socket: socket}

        clients.push(client)

        socket.emit('connected')

        socket.on('login', function(userAgent){
            client.userAgent = userAgent
            var ua = (new UAParser()).setUA(userAgent).getResult()
            client.fullName = ua.browser.name + ' ' + ua.browser.version
            + ' (' + ua.os.name + ' ' + ua.os.version + ')'
            client.name = ua.browser.name + ' ' + ua.browser.major + ' (' + ua.os.name + ')'
            console.log(client.fullName + ' connected')
        })

        consoleEvents.forEach(function(ev){
                socket.on('console.' + ev, function(message){
                    var color = ev
                    if (message.indexOf('error Not Found:') == 0){
                        color = 'error'
                        socket.emit('reload')
                    }
                    console.log(colors[color](client.name + ': ' + message))
                })
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

    var serveClientJs = serveFiles({files: ['socket.io.js' ,'watchalive.js'], wrap: true})

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
        console.warn('cleanWatchers')
        filesToWatch = []
        fileCache = {}
        lessCssMap = {}
        lessImportsDeps = {}
    }


    var reloadClients = function(){
        console.log(colors.info('Reloading ' + clients.length + ' clients...'))
        cleanWatchers()
        clients.forEach(function(client){
            client.socket.emit('reload')
        })
        clients = []

    }

    var WatchStore = require('./watch-store')
    var LessPlugin = require('./less-plugin')

    var watchStore = new WatchStore(config)
    watchStore.plugin(new LessPlugin(config.less))

    watchStore.start()

    watchStore.onChange(function(changed){

        var dataToSend = changed.map(function(changed){
            return {file: getServedFileName(changed.filePath), data: changed.data}
        })

        clients.forEach(function(client){
            client.socket.emit('files', dataToSend)
        })
    })

    var addToWatcher1 = function(filepath){
        watchStore.add(filepath)
    }

    var addToWatcher = function(filepath){

        var changed = [], changeTimeout

        if (filesToWatch.indexOf(filepath) === -1){

            fs.watchFile(filepath, {interval: config.poolInterval}, function(cur){

                setTimeout(function(){

                    if (changed.indexOf(filepath) === -1){
                        changed.push(filepath)

                        clearTimeout(changeTimeout)
                        console.log('file changed', path.relative(config.base, filepath))
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
                                    return file.match(/\.(css|less|js|stache|mustache)$/)
                                })

                                if (allowedFiles.length !== changedFiles.length){
                                    reloadClients()
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

                                    //var dataToSend = []

                                    async.map(filesToSend, function(filePath, cb){

                                        var data = fileCache[filePath]

                                        if (!data){
                                            console.warn('No data in file cache for'.error, filePath)
                                        }

                                        // check if file is mapped *.less
                                        var mappedCssFilePath = lessCssMap[filePath]
                                        if (mappedCssFilePath){
                                            removeFromFileCache(mappedCssFilePath)
                                            parseLess(filePath, data, function(err, cssData){
                                                if (err){
                                                    console.error(err)
                                                }
                                                var send = !err && fileCache[mappedCssFilePath] !== cssData

                                                cb(null, send && {filePath: mappedCssFilePath, data: cssData})

                                            })
                                        } else {
                                            removeFromFileCache(filePath)

                                            if (/\.less$/.test(filePath)){
                                                console.warn('less file', filePath, 'no mapped css in  lessCssMap')
                                            }

                                            fs.readFile(filePath, 'utf8', function(err, data){
                                                if (err){
                                                    console.error(err)
                                                }
                                                cb(null, !err && {filePath: filePath, data: data})
                                            })
                                        }
                                    }, function(err, result){

                                        var dataToSend = result.filter(function(r){return r}).map(function(r){
                                            r.data = addToFileCache(r.filePath, r.data)
                                            return {file: getServedFileName(r.filePath), data: r.data}
                                        })

                                        if (!err) {
                                            clients.forEach(function(client){
                                                client.socket.emit('files', dataToSend)
                                            })
                                        }
                                    })
                                }

                            })
                        }, config.watchChangeTimeout)

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


    app.get('*', function(req, res, next){
        //console.log('Requested', req.url)
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next()
    })

    app.get('/' + config.clientLibName, serveClientJs)


    if (config.proxies){

        var httpProxy = require('http-proxy')

        var proxy = httpProxy.createProxyServer()

        config.proxies.forEach(function(config){

            var target = config.target || (config.protocol || 'http') + '://' + (config.host || 'localhost') + ':' + (config.port || '80')

            console.log(colors.util('Proxy requests %s to %s'), config.context, target)

            app.all(config.context + '/*', function(req, res){
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

    app.get(/\.(less|js)$/, function(req, res, next){
        //console.log('request less, js', req.url)
        var filePath = path.resolve(config.base, req.url.slice(1))

        watchStore.getFileData(filePath, function(err, data){
            res.send(data)
        })

        //fs.readFile(filePath, 'utf8', function(err, data){
        //    if (err){
        //        console.log(err)
        //        next()
        //    } else {
        //        data = data.
        //            replace(/\/\/.*/g, '') // remove inline comments (two slashes)
        //            .replace(/\n/g ,'') // remove line breaks
        //            .replace(/\/\*.*?\*\//g, '') // remove standard comments (/* */)
        //        if (config.debug) {
        //            console.log('Serve clean less/css', req.url)
        //        }
        //        addToWatcher(filePath)
        //        res.send(data)
        //    }
        //
        //})
    })


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

    var sourceTransform = {
        '.js': function(source){
            return source
                .replace(/\.less!\$less/g, '.css!$css')
                .replace(/\.less!/g, '.css!')
        }
    }
    
    
    // adds file to cache and converts it as nesessary
    var addToFileCache = function(filePath, source){
        
        for (var ext in sourceTransform){
            if (path.extname(filePath) === ext){
                source = sourceTransform[ext](source)
                break
            }
        }

        fileCache[filePath] = source

        return source
    }

    var removeFromFileCache = function(filePath){
        fileCache[filePath] = undefined
    }


    var lessImportsDeps = {}
    var lessCssMap = {}

    var parseLess = function(filePath, source, callback){

        var parser = new less.Parser({
            paths: ([] || config.less.paths).concat([path.dirname(filePath)])
        })

        var addToImportsDeps = function(root){
            root.rules.forEach(function(rule){
                var imported = rule.importedFilename
                if (imported) {
                    // less import dependencies
                    var deps = lessImportsDeps[imported] || []
                    if (deps.indexOf(filePath) < 0){
                        deps.push(filePath)
                    }
                    lessImportsDeps[imported] = deps
                    addToWatcher(imported)
                    rule.root.rules && addToImportsDeps(rule.root)
                }
            })
        }

        trycatch(function(){
            parser.parse(source, function (err, tree) {
                if (err) {
                    console.error('error', err)
                    callback(err)
                    return
                }
                // add import dependencies recursively
                addToImportsDeps(tree)
                addToWatcher(filePath)

                callback(null, tree.toCSS())

            })

        }, function(err){
            console.log('Exception while parsing less', filePath, err)
            callback(err)
        })
    }

    app.get(/.css$/, function(req, res, next){
        var filePath = path.resolve(config.base, req.path.slice(1))

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
        var filePath = path.resolve(config.base, req.path.slice(1))
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


    if (config.injectScript){

        var inject = require('./inject-script')({
            base: config.base,
            script: config.clientLibName,
            onInject: function(filePath, url){
                console.log('Watchalive script injected in', url)
                addToWatcher(filePath, url)
            }
        })

        app.get(/\/[^.]*$/, inject)
        app.get('*.html', inject)
    }

    staticDirs.forEach(function(dir){
        console.log('Serve static on ', dir)
        app.use(express.static(dir, {
            setHeaders: setHeaders
        }))
    })

    server.listen(config.port);
    console.log("Watchalive server listening on port",  config.port)

    console.log("Press ENTER to reload all clients".info)

    process.stdin.on('data', function(data){
        data = data.toString().toLowerCase()

        if (/cache/.test(data)){
            console.log('File Cache:', Object.keys(fileCache))
            return
        }
        if (/map/.test(data)){
            console.log('Less Css Map:', lessCssMap)
            return
        }
        if (/clients/.test(data)){
            // ouput only string properties
            console.log('Clients', clients.length + ':', clients.map(function(c){
                var obj = {}
                Object.keys(c).forEach(function(key){typeof c[key] == 'string' && (obj[key] = c[key])})
                return obj
            }))
            return
        }
        console.log('Reloading all clients...'.info)
        reloadClients()
    })

}


module.exports = statServer
