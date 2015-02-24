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
        port: 7000,
        base: process.cwd(),
        stdin: true,
        serve: {
            clientLibName: 'watchalive.js',
            injectScript: true,
            injectSocketIo: true,
            injectScriptTo: 'head',
            favicon: 'favicon.png',
            transpile: {

            },
            route:[],
            proxy: []
        },
        watch: {
            dependencies: true,
            files: [],
            skip: [],
            served: true,
            poolInterval: 200,

        },
        clients: {
            badge: true,
            allowMessages: true,
            sendData: true
        }
    }

    config = merge(defaultConfig, options)

    config.serve = merge(defaultConfig.serve, options.serve)

    if (config.serve){
        config.serve.base = config.base
        config.serve.port = config.port
        config.serve.route = wrapArray(config.serve.route)
        config.serve.proxy = wrapArray(config.serve.proxy)
    }

    config.store = {}
    config.store.base = config.base
    config.store.watch = merge(defaultConfig.watch, options.watch)
    if (config.store.watch){
        config.store.watch.skip = wrapArray(config.store.watch.skip)
    }

    var transpile = config.serve.transpile

    if (transpile){

        if (transpile.less){
            var LessPlugin = require('./transpile/less-plugin')

            transpile.less = merge({}, transpile.less)
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
        config.serve.port = config.port
    }

    return config
}