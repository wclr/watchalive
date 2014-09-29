(function(){

    var addListener = window.addEventListener ?
        function(obj, evt, cb){ obj.addEventListener(evt, cb, false) } :
        function(obj, evt, cb){ obj.attachEvent('on' + evt, cb) }


    var connectStatus = 'disconnected'

    function getBrowserName(userAgent){
        var regexs = [
            /MS(?:(IE) (1?[0-9]\.[0-9]))/,
            /(Chrome)\/([0-9]+\.[0-9]+)/,
            /(Firefox)\/([0-9a-z]+\.[0-9a-z]+)/,
            /(Opera).*Version\/([0-9]+\.[0-9]+)/,
            /(PhantomJS)\/([0-9]+\.[0-9]+)/,
            [/(Android).*Version\/([0-9]+\.[0-9]+).*(Safari)/, function(m){
                return [m[1], m[3], m[2]].join(' ')
            }],
            [/(iPhone).*Version\/([0-9]+\.[0-9]+).*(Safari)/, function(m){
                return [m[1], m[3], m[2]].join(' ')
            }],
            [/(iPad).*Version\/([0-9]+\.[0-9]+).*(Safari)/, function(m){
                return [m[1], m[3], m[2]].join(' ')
            }],
            [/Version\/([0-9]+\.[0-9]+).*(Safari)/, function(m){
                return [m[2], m[1]].join(' ')
            }]
        ]
        for (var i = 0; i < regexs.length; i++){
            var regex = regexs[i]
            var pick = function(m){
                return m.slice(1).join(' ')
            }
            if (regex instanceof Array){
                pick = regex[1]
                regex = regex[0]
            }
            var match = userAgent.match(regex)
            if (match){
                return pick(match)
            }
        }
        return userAgent
    }

    function initUI(){
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
        font-size: 12px;\
        opacity: 0.8;\
        max-width:400px;\
        z-index: 1000;\
        cursor: pointer;\
    }\
    #__watchalive_ui__.connected{\
        color: #89e583;\
    }\
    #__watchalive_ui__.disconnected{\
        color: #cc7575;\
    }\
    </style>'
        var elm = document.createElement('div')
        elm.id = '__watchalive_ui__'
        elm.className = connectStatus
        elm.innerHTML = markup + 'WATCH ALIVE!'
        document.body.appendChild(elm)
        elm.addEventListener('click', function(){
            if (connectStatus === 'disconnected'){
                document.getElementById(elm.id).innerHTML = markup + 'WATCH ALIVE!'
                reconnect()
            } else {
                document.getElementById(elm.id).innerHTML = markup + ua
                disconnect()
            }

        })
    }

    function syncConnectStatus(){
        var elm = document.getElementById('__watchalive_ui__')
        if (elm) elm.className = connectStatus
    }

    function setConnectStatus(status){
        connectStatus = status
        syncConnectStatus()
    }

    function disconnect(){
        setConnectStatus('disconnected')
    }

    function reconnect(){
        setConnectStatus('connected')
    }

    function reloadPage(){
        window.location.reload()
    }

    function disableCssStyle(url){
        for (var i = 0; i < document.styleSheets.length; i++){
            var ss = document.styleSheets[i]
            if (ss.href == url || ss.ownerNode.innerHTML.indexOf('sourceURL=' + url) >= 0){
                //console.log('disableCssStyle ', url)
                //ss.disabled = true
                var node = ss.ownerNode
                node.parentNode.removeChild(node)
                return
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

        socket = io.connect('http://localhost');

        socket.emit('login', getBrowserName(navigator.userAgent))

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
            //console.log('watchalive files', changed)
            if (connectStatus == 'disconnected') return
            changes.forEach(function(change){
                var location = window.location
                var url = location.protocol + '//' + location.host + '/' + change.file
                disableCssStyle(url)
                addCssStyle(url, change.data)
            })

        });

        socket.on('reload', function (data) {
            if (connectStatus == 'disconnected') return
            reloadPage()
        });

    }

    function init(){
        addListener(window, 'load', initUI)
        setupSocket()
    }

    init()

})()


