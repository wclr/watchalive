var soketio = require('socket.io'),
    UAParser = require('ua-parser-js'),
    colors = require('colors')

var consoleEvents = ['log', 'warn', 'info', 'error']

var ClientsApp = function(config){

    var io = this.io = soketio(config.server || config.port)

    this.config = config
    this.clients = []

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

        socket.on('login', function(userAgent){
            client.userAgent = userAgent
            var ua = (new UAParser()).setUA(userAgent).getResult()
            client.fullName = ua.browser.name + ' ' + ua.browser.version
            + ' (' + ua.os.name + ' ' + ua.os.version + ')'
            client.name = ua.browser.name + ' ' + ua.browser.major + ' (' + ua.os.name + ')'
            console.log(client.fullName + ' connected')
            //console.log('io session', socket.request.session.client)

        })

        consoleEvents.forEach(function(ev){
            socket.on('console.' + ev, function(message){
                var color = ev
                if (message.indexOf('error Not Found:') == 0){
                    color = 'error'
                    socket.emit('reload')
                }
                console.log(colors[color](client.name + ': ' + message))
            })
        })
    });

}

ClientsApp.prototype = {

    start: function(){

        var self = this

        if (!this.watchStore) return

        this.watchStore.onChange(function(changed){

            var dataToSend = changed.map(function(changed){
                return self.config.sendData ? {file: changed.relativeBase, data: changed.data} : changed.relativeBase
            })
            var files = dataToSend.map(function(d){return d.file || d})
            console.log('Files changed', files, ',sending message', self.config.sendData ? 'with data' : '', 'to clients')
            self.clients.forEach(function(client){
                client.socket.emit('files', dataToSend)
            })
        })

    },

    stop: function(){

    },

    reloadClients: function(){
        console.log(colors.info('Reloading ' + this.clients.length + ' clients...'))
        this.clients.forEach(function(client){
            client.socket.emit('reload')
        })
        this.clients = []
    },

    checkClient: function(){

    }
}


module.exports = ClientsApp