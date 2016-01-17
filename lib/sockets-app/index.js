var soketio = require('socket.io'),
  UAParser = require('ua-parser-js'),
  colors = require('colors')

var consoleEvents = ['log', 'warn', 'info', 'error']

var SocketsApp = function(config){

  var io = this.io = soketio(config.server || config.port)

  this.config = config
  this.clients = []

  var logger = this.logger = config.logger
  this.watchStore = config.watchStore

  var self = this

  if (config.sessionMiddleware){
    io.use(function(socket, next) {
      config.sessionMiddleware(socket.request, socket.request.res, next);
    });
  }

  var clientConfig = {
    reload: config.reload,
    badge: config.badge,
    console: config.console,
    debug: config.debug
  }

  this.io.on('connection', function (socket) {

    //console.log('connection')

    var client = {socket: socket}

    self.clients.push(client)

    socket.emit('connected', clientConfig)

    socket.on('login', function(clientAuth){
      client.token = clientAuth.token
      client.userAgent = clientAuth.ua
      var ua = (new UAParser()).setUA(client.userAgent).getResult()
      client.fullName = ua.browser.name + ' ' + ua.browser.version
        + ' (' + ua.os.name + ' ' + ua.os.version + ')'
      client.name = ua.browser.name + ' ' + ua.browser.major + ' (' + ua.os.name + ')'
      logger.log(`${client.fullName} token ${client.token} connected (${self.clients.length})`)
      //console.log('io session', socket.request.session.client)

    })

    socket.on('disconnect', function () {
      socket.disconnect()
      self.clients.splice(self.clients.indexOf(client), 1)
      if (client.fullName){
        logger.warn(client.fullName, 'disconnected')
      }

    });

    consoleEvents.forEach(function(ev){
      socket.on('console.' + ev, function(message){
        var color = ev
        if (message.indexOf('error Not Found:') == 0){
          color = 'error'
          socket.emit('reload')
        }
        logger.log(colors[color](client.name + ': ' + message))
      })
    })
  });

}

SocketsApp.prototype = {

  start: function(){

    var self = this

    if (!this.watchStore) return

    this.watchStore.onChange(function(changed){

      var sendData = self.config.sendData || self.config.data

      var dataToSend = changed.map(function(changed){
        return sendData ? {file: changed.relativeBase, data: changed.data} : changed.relativeBase
      })
      var files = dataToSend.map(function(d){return d.file || d})
      self.logger.log('Files changed', files, 'sending message', sendData ? 'with data' : '', 'to clients')
      self.emit('files', dataToSend)
    })

  },

  emit: function(event, data){
    this.clients.forEach(function(client){
      client.socket.emit(event, data)
    })
  },

  reloadClients: function(){
    this.logger.info('Reloading ' + this.clients.length + ' clients...')
    this.clients.forEach(function(client){
      client.socket.emit('reload')
    })
    this.clients = []
  }
}


module.exports = SocketsApp