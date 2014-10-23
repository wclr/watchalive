(function(){

    var addListener = window.addEventListener ?
        function(obj, evt, cb){ obj.addEventListener(evt, cb, false) } :
        function(obj, evt, cb){ obj.attachEvent('on' + evt, cb) }


    var connectStatus = 'disconnected',
        options = {}

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

    // TODO: is not needed, probably remove
    function removeCssStyle(url){
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

    function replaceCssStyle(url, data){
        for (var i = 0; i < document.styleSheets.length; i++){
            var ss = document.styleSheets[i]
            if (ss.href == url){
                //console.log('disableCssStyle ', url)
                //ss.disabled = true
                var node = ss.ownerNode
                node.parentNode.removeChild(node)
                addCssStyle(url, data)
                return
            }
            if (ss.ownerNode.innerHTML.indexOf('sourceURL=' + url) >= 0){
                if (options.debug){
                    console.log('Replacing css style of ' + url)
                }
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

                if (change.file.match(/\.css$/)){
                    replaceCssStyle(url, change.data)
                    return
                }

                if (change.file.match(/\.less$/)){
                    //console.log('LESS DETECTED', url, less.optimization)

                    if (typeof less == 'object'){

                        //var commentSource = function(source){
                        //    return source.split('\n').map(function(s){return '/*' + s + '*/'}).join('\n')
                        //}
                        //

                        //change.data = change.data
                            //.replace(/\/\/.*/g, '')
                            //.replace(/\n/g ,'')
                            //.replace(/\/\*.*?\*\//g, '')

                        var parseLessFile = function(url, data, callback ){
                            var pathParts = (url + '').split('/');
                            pathParts[pathParts.length - 1] = ''; // Remove filename

                            new (less.Parser)({
                                optimization: less.optimization,
                                paths: [pathParts.join('/')],
                                useFileCache: true,
                                filename: url
                            }).parse(data, function (e, root) {
                                    if(e){
                                        console.log('Error parsing less', e, data);
                                    } else {
                                        //var source = data
                                            //.replace(/\/\/.*/g, '')
                                            //.replace(/\n/g ,'')
                                            //.replace(/\/\*.*?\*\//g, '')

                                        //console.log('parseLessFile putting less back', source)
                                        callback(url, root.toCSS() + '\n/* LESS_SOURCE=' + data +' */\n'
                                            //'/* LESS SOURCE */\n' + commentSource(data) +'\n/* END OF LESS SOURCE */\n' + root.toCSS()
                                        )
                                    }
                                });
                        }
                        var cachedUrl = '/' + change.file
                        if (less.fileCache && less.fileCache[cachedUrl]){
                            if (options.debug){
                                console.log('Replacing less cache of ' + cachedUrl)
                            }

                            less.fileCache[cachedUrl] = change.data

                            for (var i = 0; i < document.styleSheets.length; i++){
                                var ss = document.styleSheets[i]
                                cachedUrl = cachedUrl.replace(/.\less$/, '')
                                // look for styles that import this one
                                var match = new RegExp('@import\\s+(\'|")' + cachedUrl + '(\\.less)?(\'|")' )
                                if (ss.ownerNode.innerHTML.match(match)){
                                    //console.log('look for ', match)
                                    var node = ss.ownerNode,
                                        sourceMatch = node.innerHTML.match(/sourceURL=(.*?) /)

                                    if (sourceMatch){
                                        var sourceUrl = sourceMatch[1]

                                        var lessData = node.innerHTML.match(/LESS_SOURCE=([\S\s]*?) \*\/\n/)
                                        //console.log('Replacing style with import', sourceUrl, node.innerHTML.indexOf('LESS_SOURCE='), lessData)
                                        if (lessData) {
                                            if (options.debug){
                                                console.log('Replacing style with import', sourceUrl)
                                            }

                                            ;(function(node, sourceUrl, lessData){

                                                parseLessFile(sourceUrl, lessData, function(url, parsedData){
                                                    node.innerHTML = parsedData + '/*# sourceURL='+ sourceUrl +' */'
                                                })

                                            })(node, sourceUrl, lessData[1])

                                        }
                                    }
                                }
                            }

                        } else {
                            parseLessFile(url, change.data, replaceCssStyle)
                        }
                    }
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

    function init(){

        if (document.readyState == 'complete'){
            initUI()
        } else {
            document.body[window.addEventListener ? 'addEventListener' : 'attachEvent'](
                window.addEventListener ? "load" : "onload", initUI, false);
        }

        setupSocket()
    }
    // to allow watchalive object be defined
    // after /watchalive.js script tag we use setTimeout
    setTimeout(function(){
        if (typeof watchalive == 'object'){
            for (prop in watchalive){
                options[prop] == watchalive
            }
        }

        init()
    })


})()


