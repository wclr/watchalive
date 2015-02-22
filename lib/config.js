module.exports = function(config){

    config = config || {}


    var result = {}

    var merge = function(defaults, conf){
        if (conf === false) return false
        var result = {}
        for (var prop in defaults){
            result[prop] = conf && conf[prop] !== undefined ? conf[prop] : defaults[prop]
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

    result = merge(defaultConfig, config)

    result.serve = merge(defaultConfig.serve, config.serve)

    if (result.serve){
        result.serve.base = result.base
        result.serve.port = result.port
    }

    result.store = {}
    result.store.base = result.base
    result.store.watch = merge(defaultConfig.watch, config.watch)
    if (result.store.watch){
        var skip = result.store.watch.skip || []
        result.store.watch.skip = require('util').isArray(skip) ? skip : [skip]
    }

    var plugins = result.serve.plugins

    if (plugins){

        if (plugins.less){
            var LessPlugin = require('./plugins/less-plugin')

            plugins.less = merge({}, plugins.less)
            plugins.less.paths = (plugins.less.paths || []).map(function(p){path.resolve(result.base, p)})
            plugins.less.paths.push(result.base)
            plugins.less = new LessPlugin(plugins.less)
        }

        plugins = Object.keys(plugins).map(function(p){
            return plugins[p]
        })
    }

    result.store.plugins = result.serve.plugins = plugins || []

    result.clients = merge(defaultConfig.clients, config.clients)

    if (result.clients){
        result.serve.port = result.port
    }

    return result
}