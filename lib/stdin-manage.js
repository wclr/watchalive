"use strict"

module.exports = function(config){

  let logger = config.logger
  let socketsApp = config.socketsApp
  let watchStore = config.watchStore

  logger.info(`Press ENTER to output available commands`)
  process.stdin.on('data', (data) => {
    let input = data.toString().toLowerCase().trim()
    let cmd = input.split(' ')[0].trim()
    let param = input.split(' ')[1]
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
      case "d":
        logger.isDebug(!logger.isDebug())
        logger.util("DEBUG MODE " + (logger.isDebug() ? 'ACTIVE' : 'INACTIVE'))
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
        logger.info('Available commands:')
        logger.log('"clients"  - to output all connected clients')
        logger.log('"reload" - to reload all clients')
        logger.log('"watched [{filter}|log]" - get currently watched files')
        logger.log('"debug" - toggle debug mode')
        if (logger.isDebug()){
          logger.util("DEBUG MODE ACTIVE")
        }
    }
  })

}