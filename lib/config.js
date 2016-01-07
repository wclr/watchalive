var path = require('path')
var isArray = require('util').isArray

var alternativeConfigPropsMap = {
    'route': 'routes',
    'proxy': 'proxies',
    'skip': 'skips',
    'skipExcept': 'skipExcepts',
    'serve': 'serves',
    'plugin': 'plugins',
    'transform': 'transforms'
}


module.exports = function(options){

    options = options || {}

    var config = {}

    var mergeDefaults = function(defaults, options){
        if (options === false) return false

        var result = {}
        if (options){

            for (var prop in defaults){
                var alt = alternativeConfigPropsMap[prop]
                result[prop] =  options[prop] !== undefined
                    ? options[prop]
                    : (options[alt] !== undefined)
                        ? options[alt]
                        : defaults[prop]
            }
        } else {
            return Object.assign({}, defaults)
        }

        return result
    }

    var wrapArray = function(obj){
        if (!obj) return []
        return isArray(obj) ? obj : [obj]
    }

    var defaultConfig = {
        port: process.env.PORT || 7000, // port to serve files and handle socket connection
        base: process.cwd(), // base from where files are served and resolved
        stdin: true, // enable basic management via stdin commands
        debug: false, // output debug messages

        serve: {
            clientLibName: 'watchalive.js',
            injectScript: true, // inject client script in HTML automatically
            injectSocketIo: true, // if false won't load socket.io
            injectScriptTo: 'head', // where to inject script `head` or `body`
            transpile: {}, // enabled embedded and custom transpilers
            route: [], // additional flexible config for routes
            defaultRoute: '',
            proxy: [], // proxy requests config (for example to API server)
            middleware: [], // middlewares for  express.js server (NOT IMPLEMENTED)
            favicon: 'favicon.png', // use standard express.js middleware to serve favicon
            http2: false, // enables HTTP2 server
            httpOptions: false // options to pass to HTTP server,
        },
        watch: {
            dependencies: true, // watch for dependencies (of transpiled files)
            skip: [], // skip some files
            skipExcept: [], // exclude from skip some files
            served: true, // watch for files served by HTTP server
            poolInterval: 200, // interval for pooling
            debounce: 100 // delay to handle multiple
        },
        clients: {
            badge: true, // show badge on client (NOT IMPLEMENTED, badge always shown)
            reload: true, // if clients should be reloaded on change events
            console: false, // should console be intercepted on clients
            allowMessages: true, // show custom message (NOT IMPLEMENTED)
            data: false // the same is sendData
        },
        plugin: [] // plugin modules to attach
    }

    // take and structure options from plain first level
    if (options.serve !== false){
        ['serve', 'watch', 'clients'].forEach(function(section){
            if (options[section] !== false){
                options[section] = options[section] || {}
                Object.keys(defaultConfig[section]).forEach(function(prop){
                    if (options[prop] !== undefined){
                        options[section][prop] = options[section][prop] || options[prop]
                    }
                })
            }
        })
    }

    config = mergeDefaults(defaultConfig, options)

    config.serve = mergeDefaults(defaultConfig.serve, options.serve)

    config.base = path.resolve(process.cwd(), config.base)

    if (config.serve){
        config.serve.debug = config.debug
        config.serve.base = config.base
        config.serve.port = config.port
        if (typeof config.serve.route == 'string'){
            config.serve.route = {'*': config.serve.route}
        }

        config.serve.route = wrapArray(config.serve.route)
        if (typeof config.serve.defaultRoute == 'string' && config.serve.defaultRoute){
            config.serve.route.push({'*': config.serve.defaultRoute})
        }
        config.serve.proxy = wrapArray(config.serve.proxy)
        if (config.serve.favicon === true){
            config.serve.favicon = defaultConfig.serve.favicon
        }
    }

    config.store = {}
    config.store.base = config.base
    config.store.watch = mergeDefaults(defaultConfig.watch, options.watch)
    if (config.store.watch){
        config.store.debug = config.debug
        config.store.watch.skip = wrapArray(config.store.watch.skip)
        config.store.watch.skipExcept = wrapArray(config.store.watch.skipExcept)
    }

    var transpile = config.serve.transpile

    if (transpile){
        transpile = Object.keys(transpile).map(function(p){
            return transpile[p]
        })
    }

    var getPlugin = function(name){

        var cwd = process.cwd()
        try {

            var paths = [
                // first, try to require module with watchalive- prefix
                // try to require nearest module
                'watchalive-' + name,
                path.join(__dirname, '../..', 'watchalive-' + name),
                // try to require apps module
                path.join(cwd, 'node_modules', 'watchalive-' + name),
                // then try to require module without watchalive- prefix
                name,
                path.join(__dirname, '../..', name),
                path.join(cwd, 'node_modules', name)
            ]
            return paths.reduce(function(prev, p){
                try {
                    return prev || require(p)
                } catch(e) {
                    return prev
                }
            }, false)
        } catch(e){
            return false
        }
    }

    config.plugin = config.plugin.map(function(plugin){

        if (!plugin) return

        var name, options

        var foundPlugin

        if (typeof plugin == 'string'){
            name = plugin
            foundPlugin = getPlugin(name)
       } else if (isArray(plugin)){
            var firstParam = plugin[0]
            var secondParam = plugin[1]
            var lastParam = plugin[plugin.length - 1]
            var testParam

            foundPlugin = typeof firstParam == 'string' && getPlugin(firstParam)

            if (!foundPlugin){
                secondParam && (testParam = firstParam)
                foundPlugin = typeof secondParam == 'string' && getPlugin(secondParam)
            }

            // TODO apply `test` (match) for named plugin
            if (foundPlugin){
                options = lastParam
            } else {

                if (typeof lastParam == 'object'){
                    foundPlugin = lastParam
                }
                if (typeof lastParam == 'function'){
                    foundPlugin = {transform: lastParam}
                }

                if (foundPlugin){
                    testParam && (foundPlugin.test = testParam)
                    if (testParam != firstParam){
                        foundPlugin.name =  firstParam
                    }
                }
            }
        }

        plugin = foundPlugin || plugin

        if (!plugin){
            console.warn('Plugin', name, 'attach failed.')
        } else {

            options = options || {}
            options.config = config

            // check if function constructor
            if (typeof plugin == 'function' && Object.keys(plugin.prototype).length > 0){
                plugin = new plugin(options)
            }
            if (plugin.name || name){
                console.info('Plugin', plugin.name || name, 'attached.')
            }

        }

        return plugin
    }).filter(function(p){return p})

    config.store.transpile = config.serve.transpile = transpile || []
    config.store.transpile = config.store.transpile.concat(config.plugin)

    config.clients = mergeDefaults(defaultConfig.clients, options.clients)

    if (config.clients){
        config.clients.debug = config.debug
        config.clients.port = config.port
    }

    if (config.clients.data){
        config.clients.reload = false
    }

    return config
}