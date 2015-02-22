(function(){

    var io = wio || io

    var addListener = window.addEventListener ?
        function(obj, evt, cb){ obj.addEventListener(evt, cb, false) } :
        function(obj, evt, cb){ obj.attachEvent('on' + evt, cb) }


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

    function initUI(){

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

        socket.on('connected', function (data) {
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
                if (options.onFiles){
                    options.onFiles(changes)
                }

            }
        });

        socket.on('reload', function (data) {
            if (connectStatus == 'disconnected') return
            reloadPage()

        });
    }

    var interceptConsole = function(){

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

    function init(){

        watchalive = watchalive || {}
        options = watchalive


        watchalive.on = function(){
            connect()
        }

        watchalive.off = function(){
            disconnect()
        }

        watchalive.send = function(event, data){
            socket && socket.emit(event, data)
        }


        //if (typeof watchalive == 'object'){
        //    for (var prop in watchalive){
        //        options[prop] = watchalive[prop]
        //    }
        //}

        setupSocket()

        if (document.readyState == 'complete'){
            initUI()
        } else {
            addListener(window, 'load', initUI)
        }

        if (options.console){
            interceptConsole()
        }
    }

    if (typeof watchalive == 'object'){
        init()
    } else {
        //if watchalive options are NOT available init with timeout (they may appear!)
        setTimeout(init)
    }

    watchalive = typeof watchalive === 'object' ? watchalive : {}

})()