var path = require('path')

var Logger = require('./logger')
var WatchStore = require('./watch-store')
var ExpressApp = require('./express-app')
var SocketsApp = require('./sockets-app')

var App = function(options){

  var config = require('./config')(options)

  var logger = new Logger({
    isDebug: (val) => {
      if (val !== undefined){
        config.debug = val
      }
      return config.debug
    }
  })

  this.started = new Date()

  if (config.debug){
    logger.info("DEBUG MODE ACTIVE")
  }

  if (config.store){
    var watchStore = new WatchStore(
      Object.assign(
        {logger: logger.createNew('WatchStore')},
        config.store
      )
    )
  }

  if (config.serve){
    var expressApp = new ExpressApp(Object.assign({
        logger: logger.createNew('ExpressApp'),
        watchStore
      }, config.serve
    ))
  }
  var socketsApp

  if (config.clients){
    if (expressApp) {
      config.clients.server = expressApp.server
      config.clients.sessionMiddleware = expressApp.sessionMiddleware

    }
    socketsApp = new SocketsApp(Object.assign({
      logger: logger.createNew('SocketsApp'),
      watchStore,
    }, config.clients))

    if (expressApp) {
      expressApp.on(function(event, data){
        socketsApp.emit(event, data)
      })
    }
  }

  Object.assign(this, {config, logger, socketsApp, watchStore, expressApp})

  if (config.stdin){
    require('./stdin-manage')({
      app: this,
      expressApp,
      watchStore,
      socketsApp,
      logger: logger.createNew('STDIN MANAGE')
    })
  }
}

App.prototype.start = function(){

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
