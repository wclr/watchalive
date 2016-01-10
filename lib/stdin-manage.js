"use strict"

module.exports = function(config){

  let logger = config.logger
  let socketsApp = config.socketsApp
  let watchStore = config.watchStore

  logger.info(`Press ENTER to output available commands`)
  process.stdin.on('data', (data) => {
    let params = data.toString().toLowerCase().trim().split(/\s+/)
    let cmd = params.shift().trim()
    let param = params[0]
    param = param && param.trim()

    switch(cmd){
      case "clients":
      case "c":
        logger.log('Clients connected', socketsApp.clients.length + ':')
        socketsApp.clients.forEach((c) => {
          logger.log(c.fullName + ' ' + (c.token || ''))
        })
        break;
      case "debug":
        logger.isDebug(!logger.isDebug())
        logger.util("DEBUG MODE " + (logger.isDebug() ? 'ACTIVE' : 'INACTIVE'))
        break;
      case "data":
      case "d":
        if (param) {
          let filePath = watchStore.getWatched(param)[0]
          if (filePath){
            logger.log(filePath + ':')
            logger.log(watchStore.getCachedData(filePath))
          } else {
            logger.log('Not found')
          }
        }
        break;
      case "watched":
      case "w":
        switch(param){
          case "log":
            logger.log(watchStore.watcher.eventLog)
            break;
          default:
            logger.log(watchStore.getWatched(param && new RegExp(param, 'i')))
        }
        break;
      case 'reload':
      case 'r':
        socketsApp.reloadClients()
        break;
      default:
        logger.info(`WATCHALIVE DEV SERVER (started ${config.app.started})`)
        logger.info('Available commands:')
        logger.log('"clients" - to output all connected clients')
        logger.log('"reload" - to reload all clients')
        logger.log('"watched [{file math filter}|log]" - get currently watched files list')
        logger.log('"data {file match filter}" - get file source')
        logger.log('"debug" - toggle debug mode')
        if (logger.isDebug()){
          logger.util("DEBUG MODE ACTIVE")
        }
    }
  })

}