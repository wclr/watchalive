(function(){

    var io = wio

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

    // normalize urls in css against host
    var normalizeCssUrls = function(fileUrl, data){

        var baseParts, host

        function getNormalizedUrl(url) {

            // if url contains protocol do nothing
            if(url.indexOf('//') > 0){
                return url
            }

            // calculate this only if its needed, but for single time
            if (!baseParts){
                baseParts = fileUrl.split('/');
                host = baseParts.slice(0,3).join('/')
                baseParts.pop()
            }

            // if url is absolute return host + url
            if (url[0] == '/'){
                return host + url
            }

            var parts = baseParts.slice(3) // remove host part
            var urlParts = url.split('/');

            urlParts.forEach(function(part){
                if (part == '.') return
                if (part == '..'){
                    parts.pop()
                }
                parts.push(part)
            })

            return host + '/' + parts.join('/')
        }

        return data.replace(/url\(['"]?([^'"\)]*)['"]?\)/g, function( whole, part ) {
            return "url(" + getNormalizedUrl(part) + ")";
        });
    }


    function replaceCssStyle(url, data){
        data = normalizeCssUrls(url, data)
        debugLog('watchalive: replaceCssStyle', url)
        for (var i = 0; i < document.styleSheets.length; i++){
            var ss = document.styleSheets[i]
            if (ss.href == url){
                var node = ss.ownerNode
                node.parentNode.removeChild(node)
                addCssStyle(url, data)
                return
            }
            if (ss.ownerNode.innerHTML.indexOf('sourceURL=' + url) >= 0){
                debugLog('replacing css style of ' + url)
                ss.ownerNode.innerHTML = data + "/*# sourceURL="+ url +" */"
            }
        }
    }

    function addCssStyle(url, data){

        var head = document.head || document.getElementsByTagName('head')[0],
            style = document.createElement('style'),
            source = data + "/*# sourceURL="+ url +" */";

        style.type = 'text/css';
        style.href = url
        if (style.styleSheet){
            style.styleSheet.cssText = source;
        } else {
            style.appendChild(document.createTextNode(source));
        }
        head.appendChild(style);
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
            changes.forEach(function(change){
                var url = options.host + '/' + change.file
                debugLog('change', url)
                if (change.file.match(/\.css$/)){
                    replaceCssStyle(url, change.data)
                }
            })

        });

        socket.on('reload', function (data) {
            if (connectStatus == 'disconnected') return
            if (options.reload !== false){
                reloadPage()
            }
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
                    //return (typeof a === 'object') ? JSON.stringify(a) : a && a.toString()
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

        if (typeof watchalive == 'object'){
            for (var prop in watchalive){
                options[prop] = watchalive[prop]
            }
        }
        setupSocket()

        //alert('watchalive' + document.readyState)
        if (document.readyState == 'complete'){
            initUI()
        } else {
            //alert('watchalive bind')
            addListener(window, 'load', initUI)
            //document.addEventListener("deviceready", initUI, false);
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

})()