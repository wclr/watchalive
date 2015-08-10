
var path = require('path')

module.exports = function(options){

    options = options || {}

    var config = {}

    var merge = function(defaults, options){
        if (options === false) return false
        var result = {}
        for (var prop in defaults){
            result[prop] = options && options[prop] !== undefined ? options[prop] : defaults[prop]
        }
        return result
    }

    var wrapArray = function(obj){
        if (!obj) return []
        return require('util').isArray(obj) ? obj : [obj]
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
            files: [], // additionally watch for matched files (NOT IMPLEMENTED)
            skip: [], // skip some files
            served: true, // watch for files served by HTTP server
            poolInterval: 200, // interval for pooling
            debounce: 100 // delay to handle multiple
        },
        clients: {
            badge: true, // show badge on client (NOT IMPLEMENTED, badge always shown)
            reload: false, // if clients should be reloaded on change events
            console: false, // should console be intercepted on clients
            allowMessages: true, // show custom message (NOT IMPLEMENTED)
            //remove
            sendData: false, // send changed files data to client
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

    config = merge(defaultConfig, options)

    config.serve = merge(defaultConfig.serve, options.serve)

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
    config.store.watch = merge(defaultConfig.watch, options.watch)
    if (config.store.watch){
        config.store.debug = config.debug
        config.store.watch.skip = wrapArray(config.store.watch.skip)
    }

    var transpile = config.serve.transpile

    if (transpile){
        transpile = Object.keys(transpile).map(function(p){
            return transpile[p]
        })
    }

    var getPlugin = function(name){
        var cwd = process.cwd()
        var paths = [
            'watchalive-' + name,
            name,
            path.join(cwd, 'node_modules', 'watchalive-' + name),
            path.join(cwd, 'node_modules', name)
        ]
        var plugin
        paths.every(function(p){
            try {
                plugin = require(p)
            } catch(e){}
            return !plugin
        })
        return plugin
    }

    config.plugin = config.plugin.map(function(plugin){

        if (!plugin) return

        var name, options

        if (typeof plugin == 'string'){
            name = plugin
        }

        if (typeof plugin == 'object' && Object.keys(plugin).length == 1){
            name = Object.keys(plugin)[0]
            options = plugin[name]
        }

        plugin = name && getPlugin(name)

        if (!plugin){
            console.warn('Plugin', name, 'attach failed.')
        } else {

            options = options || {}
            options.config = config

            // check if function constructor
            if (typeof plugin == 'function' && Object.keys(plugin.prototype).length > 0){
                plugin = new plugin(options)
            }
            console.info('Plugin', plugin.name || name, 'attached.')
        }

        return plugin
    }).filter(function(p){return p})

    config.store.transpile = config.serve.transpile = transpile || []
    config.store.transpile = config.store.transpile.concat(config.plugin)

    config.clients = merge(defaultConfig.clients, options.clients)

    if (config.clients){
        config.clients.debug = config.debug
        config.clients.port = config.port
    }

    return config
}