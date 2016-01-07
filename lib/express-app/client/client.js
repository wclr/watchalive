(function(){

    var io = window.wio || window.io

    var addListener = window.addEventListener ?
        function(obj, evt, cb){ obj.addEventListener(evt, cb, false) } :
        function(obj, evt, cb){ obj.attachEvent('on' + evt, cb) }


    var merge = function(dest, source){
        for (var prop in source){
            dest[prop] = source[prop]
        }
    }

    var connectStatus = 'disconnected',
        options = {
            host: location.origin || (location.protocol + '//' + location.host)
        }

    var elm
    var ua = navigator.userAgent
    var cssSource = '\
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
        #__watchalive_ui__ .error{\
            color: #cc3f37;\
        }\
        #__watchalive_ui__ .warn{\
            color: #cc8420;\
        }\
        #__watchalive_ui__.connected{\
            color: #89e583;\
        }\
        #__watchalive_ui__.disconnected{\
            color: #cc7575;\
        }\
        '

    var addStyle = function(){
        var head = document.head || document.getElementsByTagName('head')[0],
            style = document.createElement('style')
        console.log('addStyle')

        style.type = 'text/css';
        if (style.styleSheet){
            style.styleSheet.cssText = cssSource;
        } else {
            style.appendChild(document.createTextNode(cssSource));
        }
        head.appendChild(style);
    }


    var debugLog = function(){
        if (options.debug){
            var args = Array.prototype.slice.call(arguments);
            args.unshift('watchalive debug:');
            console.log.apply(console, args)
        }
    }

    var addHtml = function(html, br){
        if (elm){
            elm.innerHTML += html
        }
    }

    var toggleThick = function(state){
        if (elm){
            elm.setAttribute('thick', state)
        }
    }

    var clearState = function(){
        elm.innerHTML = ''
        addHtml('WATCH ALIVE!')
    }

    var getBadgeElement = function(){
        return document.getElementById('__watchalive_ui__')
    }

    var removeBadge = function(){
        var el = getBadgeElement()
        el && el.remove()
    }

    var showBadge = function() {

        var element = getBadgeElement()

        if (element || options.badge == false || options.noBadge){
            return
        }

        elm = document.createElement('div')
        elm.id = '__watchalive_ui__'
        elm.className = connectStatus
        //elm.innerHTML = markup + 'WATCH ALIVE!'
        clearState()

        document.body.appendChild(elm)
        var opacityTimeout
        elm.addEventListener('click', function(){
            toggleThick('true')
            clearTimeout(opacityTimeout)
            if (isConnected()){
                disconnect()
            } else {
                reconnect()
                opacityTimeout = setTimeout(function(){
                    toggleThick('false')
                }, 2000)

            }
        })
    }

    var initUI = function(){
        if (!getBadgeElement()){
            addStyle()
            showBadge()
        }
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
        elm.innerHTML = ''
        addHtml(ua)
        setConnectStatus('disconnected')
    }

    function reconnect(){
        elm.innerHTML = ''
        addHtml('WATCH ALIVE!')
        setConnectStatus('connected')

    }

    function reloadPage(){
        window.location.reload()
    }

    var socket

    function setupSocket(){

        socket = io.connect(options.host);

        socket.emit('login', {token: token, ua: navigator.userAgent})

        socket.on('connected', function (config) {

            debugLog('connected config', config)

            for (var prop in config){
                if (options[prop] === undefined){
                    options[prop] = config[prop]
                }
            }

            debugLog('connected options', options)

            setupOptions()

            if (connectStatus == 'connected'){
                reloadPage()
                return
            }

            socket.emit('options', options)

            connectStatus = 'connected'
            syncConnectStatus()
        })

        socket.on('disconnected', function (data) {
            connectStatus = 'disconnected'
            syncConnectStatus()
        })

        socket.on('error', function (data) {
            toggleThick('true')
            addHtml('<br/><span class="error">' + data+ '</span>')
        })

        socket.on('warn', function (data) {
            toggleThick('true')
            addHtml('<br/><span class="warn">' + data + '</span>', true)
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

    var token = document
        .getElementById('__watchalive_token__')
        .getAttribute('content')

    if (typeof watchalive == 'object'){
        merge(options, watchalive)
    }

    watchalive = {
        config: function(opts){
            merge(options, opts)

            socket.emit('options', options)
            setupOptions()

            return options
        },

        on: function(evName, handler){
            eventHandlers[evName] = eventHandlers[evName] || []
            eventHandlers[evName].push(handler)
        },

        showBadge: function(){
            showBadge()
        },

        clear: function(){
            clearState()
        },

        removeBadge: removeBadge,

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