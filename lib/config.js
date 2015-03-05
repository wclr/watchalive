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
        port: 7000, // port to serve files and handle socket connection
        base: process.cwd(),
        stdin: true, // enable basic management via stdin commands
        debug: false, // output debug messages

        serve: {
            clientLibName: 'watchalive.js',
            injectScript: true,
            injectSocketIo: true,
            injectScriptTo: 'head',
            transpile: {

            },
            route:[],
            proxy: [],
            middleware: [],
            favicon: 'favicon.png',
            http2: false,
            httpOptions: false
        },
        watch: {
            dependencies: true,
            files: [],
            skip: [],
            served: true,
            poolInterval: 200

        },
        clients: {
            badge: true,
            allowMessages: true,
            sendData: true
        }
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
        config.serve.route = wrapArray(config.serve.route)
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

        if (transpile.less){
            var LessPlugin = require('./transpilers/less-transpiler')

            transpile.less = merge({}, transpile.less)
            // add base to paths
            transpile.less.paths = (transpile.less.paths || []).map(function(p){path.resolve(config.base, p)})
            transpile.less.paths.push(config.base)
            transpile.less = new LessPlugin(transpile.less)
        }

        transpile = Object.keys(transpile).map(function(p){
            return transpile[p]
        })
    }

    config.store.transpile = config.serve.transpile = transpile || []

    config.clients = merge(defaultConfig.clients, options.clients)

    if (config.clients){
        config.clients.debug = config.debug
        config.clients.port = config.port
    }

    return config
}