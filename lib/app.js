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

    this.config = require('./config')(options)

    var WatchStore = require('./watch-store')
    var ExpressApp = require('./express-app')
    var SocketsApp = require('./sockets-app')

    if (this.config.store){
        this.watchStore = new WatchStore(this.config.store)
    }

    if (this.config.serve){
        this.expressApp = new ExpressApp(this.config.serve)
        this.expressApp.watchStore = this.watchStore
    }

    if (this.config.clients){
        if (this.expressApp) {
            this.config.clients.server = this.expressApp.server
            this.config.clients.sessionMiddleware = this.expressApp.sessionMiddleware

        }
        this.socketsApp = new SocketsApp(this.config.clients)
        this.socketsApp.watchStore = this.watchStore
    }

    if (this.config.stdin){
        require('./stdin-manage')(this.socketsApp)
    }
}

App.prototype.start = function(){
    console.log('Starting WATCHALIVE...'.info)
    this.watchStore && this.watchStore.start()
    this.expressApp && this.expressApp.start()
    this.socketsApp && this.socketsApp.start()
}

App.prototype.stop = function(){
    this.watchStore && this.watchStore.stop()
    this.expressApp && this.expressApp.stop()
    this.socketsApp && this.socketsApp.stop()
}


module.exports = App
