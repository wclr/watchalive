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


    // Topological sort
    // The code is stolen from https://github.com/marcelklehr/toposort/blob/master/index.js
    var toposort = function(nodes, edges) {

        var cursor = nodes.length
            , sorted = new Array(cursor)
            , visited = {}
            , i = cursor

        while (i--) {
            if (!visited[i]) visit(nodes[i], i, [])
        }

        return sorted

        function visit(node, i, predecessors) {
            if(predecessors.indexOf(node) >= 0) {
                throw new Error('Cyclic dependency: '+JSON.stringify(node))
            }

            if (visited[i]) return;
            visited[i] = true

            // outgoing edges
            var outgoing = edges.filter(function(edge){
                return edge[0] === node
            })
            if (i = outgoing.length) {
                var preds = predecessors.concat(node)
                do {
                    var child = outgoing[--i][1]
                    visit(child, nodes.indexOf(child), preds)
                } while (i)
            }

            sorted[--cursor] = node
        }
    }

    var reloadHot = function(changes){
        var main = System.main,
            hotReload = options.hotReload || {}

        var removeDOM = function(){
            debugLog('Removing DOM....')
            // Remove only non-standard elements by default, including elements with nodeName my-component or #text
            for (var i = document.body.childNodes.length - 1; i > 0 ; i--){
                var node = document.body.childNodes[i]
                if (!/^\w+$/i.test(node.nodeName) || hotReload.removeAllDOM){

                    // use jquery to remove DOM if available
                    if (typeof $ == 'function' && typeof $.Event == 'function'){
                        $(node).remove()
                    } else {
                        document.body.removeChild(node)
                    }
                }
            }
        }

        if (hotReload.clearConsole !== false && console.clear){
            console.clear()
        }

        var loadsMap = System.loadsMap

        var allDependents = {}

        var compareArrays = function(array1, array2){
            return (array1.length == array2.length) && array1.every(function(element, index) {
                return element === array2[index];
            });
        }

        var findDependants = function(module){

            var dependants = {}

            var checkDeps = function(load){
                if (allDependents[load.name]) return
                if (load.normalized.indexOf(module) >= 0){
                    allDependents[load.name] = load
                    dependants[load.name] = load
                }
            }

            // Find dependent modules (loads) for changed module
            return new Promise(function(resolve){

                Promise.all(Object.keys(loadsMap.modules).map(function(m){
                    if (m == module){
                        return Promise.resolve()
                    }

                    var load = loadsMap.modules[m]
                    var additionalDeps = loadsMap.deps && loadsMap.deps[load.name]
                    if (additionalDeps){
                        load.metadata.deps = load.metadata.deps.concat(additionalDeps)
                    }
                    return new Promise(function(resolve){
                        if (load.normalized instanceof Promise){
                            return load.normalized.then(resolve)
                        }
                        //if (/reading-details\/reading-details/.test(load.name)){
                        //    console.log('normalize', module, load.prevDeps && load.prevDeps.length, load.metadata.deps.length, load.nomalized && load.nomalized.length, load.prevFailed)
                        //}
                        //if (load.prevFailed){
                        //    return resolve()
                        //}
                        if (load.prevDeps && !compareArrays(load.prevDeps, load.metadata.deps) && !load.prevFailed){
                            load.normalized = false
                        }
                        if (load.normalized){
                            checkDeps(load)
                            resolve()
                        } else {
                            load.normalized = Promise.all(load.metadata.deps.map(function(dep){
                                return System.normalize(dep, load.name, load.address)
                            })).then(function(normalized){
                                load.normalized = normalized
                                checkDeps(load)
                                resolve()
                            })
                        }
                    })
                })).then(function(){
                    resolve(dependants)
                })
            })
        }

        var findDependantsMulti = function(modules){
            return new Promise(function(resolve){
                Promise.all(modules.map(function(m){
                    return findDependants(m)
                })).then(function(multi){
                    Promise.all(multi.map(function(m){
                        return findDependantsMulti(Object.keys(m))
                    })).then(resolve)
                })
            })
        }

        var changedModules = changes.map(function(change){

            var load = loadsMap.addrs[change.file]

            if (!load){
                console.log('No module in loadMaps for changed file', change.file)
                reloadPage()
                return
            }

            load.source = change.data
            return load.name
        }).filter(function(m){return !!m})

        findDependantsMulti(changedModules).then(function(){

            // Create dependency graph and sort it topologically
            var depGraph = [],
                modules = Object.keys(allDependents)

            modules.forEach(function(module){
                allDependents[module].normalized.forEach(function(dep){
                    if (loadsMap.modules[dep]){
                        depGraph.push([dep, module])
                    }
                })
            })

            var nodes = modules.concat(changedModules)
            var queuedModules = toposort(nodes, depGraph)

            if (queuedModules.indexOf(main) < 0){
                queuedModules.push(main)
            }

            if (queuedModules[queuedModules.length - 1] !== main){
                console.error('main module is not last in import queue', queuedModules)
            }

            if (typeof hotReload.removeDOM == 'function'){
                hotReload.removeDOM()
            } else if (hotReload.removeDOM !== false){
                removeDOM()
                if (typeof hotReload.afterRemoveDOM == 'function'){
                    hotReload.afterRemoveDOM()
                }
            }

            debugLog('queue', queuedModules)

            // Loop through queue imports
            queuedModules.reduce(function(imp, module) {

                return imp.then(function(){
                    var deleted = System.delete(module)
                    if (!deleted){
                        debugLog('System.delete', module, 'returned false')
                    }

                    var load = loadsMap.modules[module]
                    debugLog('System.define/import', module, 'prevFailed', load.prevFailed)

                    // some hacky method to handle error module
                    if (load.prevFailed){
                        return new Promise(function(resolve){
                                //console.log('importing module', module)
                                System.import(module).then(function(){
                                    System.delete(module)
                                    System.import(module).then(function(){
                                        console.log('SET prevFailed TRUE', module)
                                        load.prevFailed = false
                                        resolve()
                                    })
                                })
                        })
                    }

                    // Every time we define module deps are appended to existing, so clean it up
                    load.prevDeps = load.metadata.deps
                    load.metadata.deps = []
                    return new Promise(function(resolve, reject){
                        System.define(module, load.source, {address: load.address, metadata: load.metadata})
                            .then(resolve)
                            .catch(function(e){
                                loadsMap.modules[module].prevFailed = true
                                console.warn('System.define', module, e, loadsMap.modules[module])
                                reject()
                            })
                    })
                })
            }, Promise.resolve());
        })
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
            var sourceChanges = []
            changes.forEach(function(change){
                var url = options.host + '/' + change.file
                debugLog('change', url, change)
                if (change.file.match(/\.css$/)){
                    replaceCssStyle(url, change.data)
                } else {
                    sourceChanges.push(change)
                }
            })
            if (sourceChanges.length){
                if (options.hotReload){
                    reloadHot(sourceChanges)
                } else {
                    reloadPage()
                }
            }
        });

        socket.on('reload', function (data) {
            if (connectStatus == 'disconnected') return
            //if (options.hotReload){
            //    reloadHot(data)
            //} else
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