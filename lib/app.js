var path = require('path'),
    colors = require('colors')

colors.setTheme({
    info: 'green',
    log: 'grey',
    warn: 'yellow',
    error: 'red',
    util: 'grey',
    help: 'cyan',
    debug: 'blue'
})

var App = function(options){

    //var config = {
    //    port: 7000,
    //    base: process.cwd(),
    //    stdin: true,
    //    clientLibName: 'watchalive.js',
    //    poolInterval: 200,
    //    watchChangeTimeout: 100,
    //    injectScript: true,
    //    favicon: 'favicon.png',
    //    less: {}
    //}
    //
    //
    //
    //
    //for (var prop in options){
    //    if (options[prop] !== undefined) {
    //        config[prop] = options[prop]
    //    }
    //}
    //if (typeof options.base == 'string'){
    //    config.base = path.resolve(process.cwd(), options.base)
    //}

    this.config = require('./config')(options)

    var WatchStore = require('./watch-store')
    var ExpressApp = require('./express-app')
    var ClientsApp = require('./clients-app')

    if (this.config.store){
        this.watchStore = new WatchStore(this.config.store)
    }

    if (this.config.watch){
        this.expressApp = new ExpressApp(this.config.serve)
        this.expressApp.watchStore = this.watchStore
    }

    if (this.config.clients){
        if (this.expressApp) {
            this.config.clients.server = this.expressApp.server
            this.config.clients.sessionMiddleware = this.expressApp.sessionMiddleware

        }
        this.clientsApp = new ClientsApp(this.config.clients)
        this.clientsApp.watchStore = this.watchStore
    }

    if (this.config.stdin){
        require('./clients-app/stdin-manage')(this.clientsApp)
    }
}

App.prototype.start = function(){
    this.watchStore && this.watchStore.start()
    this.expressApp && this.expressApp.start()
    this.clientsApp && this.clientsApp.start()
}

App.prototype.stop = function(){
    this.watchStore && this.watchStore.stop()
    this.expressApp && this.expressApp.stop()
    this.clientsApp && this.clientsApp.stop()
}


module.exports = App
