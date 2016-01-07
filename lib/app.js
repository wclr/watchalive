var path = require('path')

var Logger = require('./logger')

var App = function(options){

    this.config = require('./config')(options)
    this.logger = new Logger({
        isDebug: (val) => {
            if (val !== undefined){
                this.config.debug = val
            }
            return this.config.debug
        }
    })

    this.logger.util("DEBUG MODE ACTIVE")

    var WatchStore = require('./watch-store')
    var ExpressApp = require('./express-app')
    var SocketsApp = require('./sockets-app')

    if (this.config.store){
        this.watchStore = new WatchStore(
            Object.assign(
                {logger: this.logger.createNew('WatchStore')},
                this.config.store
            )
        )
    }

    if (this.config.serve){
        this.expressApp = new ExpressApp(Object.assign({
                logger: this.logger.createNew('ExpressApp'),
                watchStore: this.watchStore
            }, this.config.serve
        ))
        //this.expressApp.watchStore = this.watchStore
    }

    if (this.config.clients){
        if (this.expressApp) {
            this.config.clients.server = this.expressApp.server
            this.config.clients.sessionMiddleware = this.expressApp.sessionMiddleware

        }
        this.socketsApp = new SocketsApp(Object.assign({
            logger: this.logger.createNew('SocketsApp'),
            watchStore: this.watchStore
        }, this.config.clients))

        if (this.expressApp) {
            var socketsApp = this.socketsApp
            this.expressApp.on(function(event, data){
                socketsApp.emit(event, data)
            })
        }

    }

    if (this.config.stdin){
        require('./stdin-manage')({
            expressApp: this.expressApp,
            watchStore: this.watchStore,
            socketsApp: this.socketsApp,
            logger: this.logger.createNew('STDIN MANAGE')
        })
    }
}

App.prototype.start = function(){
    //this.logger.info('Starting WATCHALIVE...')
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
