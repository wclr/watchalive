(function(){

    var io = window.wio || window.io

    var addListener = window.addEventListener ?
        function(obj, evt, cb){ obj.addEventListener(evt, cb, false) } :
        function(obj, evt, cb){ obj.attachEvent('on' + evt, cb) }


    var merge = function(defaults, options){
        if (options === false) return false
        var result = {}
        for (var prop in defaults){
            result[prop] = options && options[prop] !== undefined ? options[prop] : defaults[prop]
        }
        return result
    }

    var connectStatus = 'disconnected',
        options = {
            host: location.origin || (location.protocol + '//' + location.host)
        }

    var elm
    var ua = navigator.userAgent
    var markup = '\
        <style>\
        #__watchalive_ui__{\
            position: fixed;\
            bottom: 5px;\
            right: 5px;\
            background-color: #444;\
            padding: 3px;\
            color: #fff;\
            font-family: Monaco, monospace;\
            font-size: 14px;\
            opacity: 0.1;\
            max-width:400px;\
            z-index: 1000;\
            cursor: pointer;\
        }\
        #__watchalive_ui__[thick="true"]{\
            opacity: 0.8\
        }\
        #__watchalive_ui__.connected{\
            color: #89e583;\
        }\
        #__watchalive_ui__.disconnected{\
            color: #cc7575;\
        }\
        </style>'


    var debugLog = function(){
        if (options.debug){
            var args = Array.prototype.slice.call(arguments);
            args.unshift('watchalive debug:');
            console.log.apply(console, args)
        }
    }
    var isUIInitialized = false

    function initUI(){

        if (isUIInitialized){
            return
        }
        isUIInitialized = true

        elm = document.createElement('div')
        elm.id = '__watchalive_ui__'
        elm.className = connectStatus
        elm.innerHTML = markup + 'WATCH ALIVE!'
        document.body.appendChild(elm)
        var opacityTimeout
        elm.addEventListener('click', function(){
            elm.setAttribute('thick', 'true')
            clearTimeout(opacityTimeout)
            if (isConnected()){
                disconnect()
            } else {
                reconnect()
                opacityTimeout = setTimeout(function(){
                    elm.setAttribute('thick', 'false')
                }, 2000)

            }
        })
    }

    function syncConnectStatus(){
        if (elm) elm.className = connectStatus
    }

    function setConnectStatus(status){
        connectStatus = status
        socket.emit(status)
        syncConnectStatus()
    }

    function isConnected(){
        return connectStatus == 'connected'
    }

    function disconnect(){
        elm.innerHTML = markup + ua
        setConnectStatus('disconnected')
    }

    function reconnect(){
        elm.innerHTML = markup + 'WATCH ALIVE!'
        setConnectStatus('connected')

    }

    function reloadPage(){
        window.location.reload()
    }

    var socket

    function setupSocket(){

        socket = io.connect(options.host);

        socket.emit('login', navigator.userAgent)

        socket.on('connected', function (config) {

            for (var prop in config){
                if (options[prop] === undefined){
                    options[prop] = config[prop]
                }
            }

            setupOptions()

            if (connectStatus == 'connected'){
                reloadPage()
                return
            }
            connectStatus = 'connected'
            syncConnectStatus()
        })

        socket.on('disconnected', function (data) {
            connectStatus = 'disconnected'
            syncConnectStatus()
        })



        socket.on('files', function (changes) {

            if (connectStatus == 'disconnected') return

            if (options.reload){
                return reloadPage()
            }

            if (changes.length){
                var handlers = eventHandlers['files']
                handlers && handlers.forEach(function(handler){
                    handler(changes)
                })
            }
        });

        socket.on('reload', function (data) {
            if (connectStatus == 'disconnected') return
            reloadPage()

        });
    }

    var consoleIntercepted = false

    var interceptConsole = function(){

        if (consoleIntercepted) return

        var consoleParam = options.console

        var methods = consoleParam.forEach
            ? consoleParam
            : typeof  consoleParam == 'string' ? consoleParam.split(' ') : ['log', 'warn', 'info', 'error']

        methods.forEach(function (m) {
            var oldMethod = window.console[m]
            window.console[m] = function () {
                var args = Array.prototype.slice.call(arguments);
                var message = args.map(function(a){
                    return (typeof a === 'object' && a != null) ? '[object]' : a
                }).join(' ')
                if (isConnected()){
                    socket.emit('console.' + m, message)
                }
                oldMethod && oldMethod.apply(console, arguments)
            }
        })
    }

    function setupOptions(){

        if (document.readyState == 'complete'){
            initUI()
        } else {
            addListener(window, 'load', initUI)
        }

        if (options.console){
            interceptConsole()
        }
    }

    var eventHandlers = {}


    if (typeof watchalive == 'object'){
        options = merge(options, watchalive)
    }

    watchalive = {
        config: function(opts){
            options = merge(options, opts)
        },

        on: function(evName, handler){
            eventHandlers[evName] = eventHandlers[evName] || []
            eventHandlers[evName].push(handler)
        },

        showBadge: function(){
            isUIInitialized = false
            initUI()
        },

        onFiles: function(handler){
            this.on('files', handler)
        },
        connect: function(){
            reconnect()
        },
        disconnect: function(){
            disconnect()
        },
        send: function(event, data){
            socket && socket.emit(event, data)
        }
    }

    if (typeof options.onFiles == 'function'){
        watchalive.onFiles(options.onFiles)
    }

    setupSocket()

})()