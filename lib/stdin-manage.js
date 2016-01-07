"use strict"

module.exports = function(config){

    let logger = config.logger
    let socketsApp = config.socketsApp
    let watchStore = config.watchStore

    logger.info(`Press ENTER to output available commands`)
    process.stdin.on('data', (data) => {
        let cmd = data.toString().toLowerCase().trim()

        switch(cmd){
            case "clients":
            case "c":
                console.log('Clients connected', socketsApp.clients.length + ':')
                socketsApp.clients.forEach((c) => {
                    console.log(c.fullName + ' ' + (c.token || ''))
                })
                break;
            case "debug":
            case "d":
                logger.isDebug(!logger.isDebug())
                logger.util("DEBUG MODE " + (logger.isDebug() ? 'ACTIVE' : 'INACTIVE'))
                break;
            case "watched":
            case "w":
                logger.log(watchStore.getWatched())
                break;
            case 'reload':
            case 'r':
                socketsApp.reloadClients()
                break;
            default:
                logger.info('Available commands:')
                logger.log('"clients"  - to output all connected clients')
                logger.log('"reload" - to reload all clients')
                logger.log('"watched" - get currently watched files')
                logger.log('"debug" - toggle debug mode')
                if (logger.isDebug()){
                    logger.util("DEBUG MODE ACTIVE")
                }
        }
    })

}