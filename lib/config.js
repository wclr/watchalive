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
            plugins: {

            },
            routes:[],
            proxies: []
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

    config = merge(defaultConfig, options)

    config.serve = merge(defaultConfig.serve, options.serve)

    if (config.serve){
        config.serve.base = config.base
        config.serve.port = config.port
    }

    config.store = {}
    config.store.base = config.base
    config.store.watch = merge(defaultConfig.watch, options.watch)
    if (config.store.watch){
        var skip = config.store.watch.skip || []
        config.store.watch.skip = require('util').isArray(skip) ? skip : [skip]
    }

    var plugins = config.serve.plugins

    if (plugins){

        if (plugins.less){
            var LessPlugin = require('./plugins/less-plugin')

            plugins.less = merge({}, plugins.less)
            plugins.less.paths = (plugins.less.paths || []).map(function(p){path.resolve(config.base, p)})
            plugins.less.paths.push(config.base)
            plugins.less = new LessPlugin(plugins.less)
        }

        plugins = Object.keys(plugins).map(function(p){
            return plugins[p]
        })
    }

    config.store.plugins = config.serve.plugins = plugins || []

    config.clients = merge(defaultConfig.clients, options.clients)

    if (config.clients){
        config.serve.port = config.port
    }

    return config
}