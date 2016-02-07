(function(){

  // we load socket.io version as `wio` not mess with app's version
  var io = window.wio || window.io

  // helper to correctly attach events
  var addListener = window.addEventListener ?
    function(obj, evt, cb){ obj.addEventListener(evt, cb, false) } :
    function(obj, evt, cb){ obj.attachEvent('on' + evt, cb) }


  // helper for correct merge ats like Object.assign
  var merge = function(dest, source){
    for (var prop in source){
      dest[prop] = source[prop]
    }
  }

  // a little bit v-hyperscript fake
  var h = function(tag, inner){
    var cls = tag.split('.').slice(1).join(' ')
    tag = tag.split('.')[0]
    cls = cls ? ' class="' + cls + '"' : ''
    return (
      '<' + tag + cls + '>'
      + (Array.isArray(inner) ? inner.join('') : inner)
      + '</' + tag + '>'
    )
  }

  var elm
  var ua = navigator.userAgent
  var cssSource = '\
        #__watchalive_ui__{\
            position: fixed;\
            bottom: 5px;\
            right: 5px;\
            padding: 3px;\
            color: #fff;\
            font-family: Monaco, monospace;\
            font-size: 14px;\
            max-width:400px;\
            z-index: 1000;\
            cursor: pointer;\
        }\
        #__watchalive_ui__ > div {\
            background-color: #444;\
            opacity: 0.1;\
        }\
        #__watchalive_ui__ > div.thick{\
            opacity: 0.90\
        }\
        #__watchalive_ui__ .error{\
            color: #f42a26;\
        }\
        #__watchalive_ui__ .warn{\
            color: #ffa631;\
        }\
        #__watchalive_ui__ > div.connected{\
            color: #89e583;\
        }\
        #__watchalive_ui__ > div.disconnected{\
            color: #cc7575;\
        }\
        '

  // place UI badge style into document head
  var addStyle = function(){
    var head = document.head || document.getElementsByTagName('head')[0],
      style = document.createElement('style')

    style.type = 'text/css';
    if (style.styleSheet){
      style.styleSheet.cssText = cssSource;
    } else {
      style.appendChild(document.createTextNode(cssSource));
    }
    head.appendChild(style);
  }

  var options = {
      host: location.origin || (location.protocol + '//' + location.host)
    }

  var state = {
    status: 'disconnected',
    messages: []
  }

  var setState = function(update){
    update && merge(state, update)
    render()
  }

  var render = function(){
    var el = getUIElement()
    if (!el) return
    var thick = state.status == 'disconnected' || state.messages.length ? 'thick' : ''
    var mainText = state.status
      ? state.status == 'connected' ? 'WATCHALIVE!' : ua
      : 'Not connected'
    el.innerHTML = h(['div', state.status, thick].join('.'), [
      h('div', mainText),
      state.messages.length
        ? h('div', state.messages.map(function(m){
            return h('div.'+ m.type, m.text)
          }))
        : ''
    ])
  }

  var cleanConsole

  var consoleOutput = function(method, data){
    if (cleanConsole){
      cleanConsole[method].call(console, '[watchalive]', data)
    } else {
      console[method].call(console, '[watchalive]', data)
    }
  }

  // helper to output debug messages
  var debugLog = function(message){
    if (options.debug){
      //var args = Array.prototype.slice.call(arguments);
      //args.unshift('[watchalive]');
      consoleOutput('info', message)
    }
  }

  var clearState = function(status){
    setState({
      status: (!state.messages.length && status) || state.status,
      messages: []
    })
  }

  var getUIElement = function(){
    return document.getElementById('__watchalive_ui__')
  }

  var removeUI = function(){
    var el = getUIElement()
    el && el.remove()
  }

  var showUI = function() {

    var element = getUIElement()

    if (element || options.ui == false){
      return
    }

    elm = document.createElement('div')
    elm.id = '__watchalive_ui__'
    clearState()

    document.body.appendChild(elm)

    elm.addEventListener('click', function(){
      if (isConnected()){
        clearState('disconnected')
      } else {
        clearState('connected')
      }
    }, true)
  }

  function isConnected(){
    return state.status == 'connected'
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

      if (state.status == 'connected'){
        //return reloadPage()
      }

      socket.emit('options', options)
      setState({status: 'connected'})
    })

    socket.on('disconnected', function (data) {
      setState({status: 'disconnected'})
    })

    socket.on('server.error', function (data) {
      state.messages.push({
        type: 'error',
        text: data.substring(0, 255)
      })
      setState()
      consoleOutput('error', data)
    })

    socket.on('server.warn', function (data) {
      state.messages.push({
          type: 'warn',
          text: data.substring(0, 255)
      })
      setState()
      consoleOutput('warn', data)
    })

    socket.on('server.files', function (changes) {

      if (state.status == 'disconnected') return

      if (options.reload){
        return reloadPage()
      }

      if (changes.length){
        clearState()
        var handlers = eventHandlers['files']
        handlers && handlers.forEach(function(handler){
          handler(changes)
        })
      }
    });

    socket.on('server.reload', function (data) {
      if (state.status == 'disconnected') return
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
    cleanConsole = {}
    methods.forEach(function (m) {
      var oldMethod = window.console[m]
      cleanConsole[m] = oldMethod
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

    var initUI = function(){
      if (!getUIElement()){
        addStyle()
        showUI()
      }
    }

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

  var tokenEl = document
    .getElementById('__watchalive_token__')

  var token = tokenEl && tokenEl.getAttribute('content') || ''

  // we can handle watchalive config as object prior init
  if (typeof watchalive == 'object'){
    merge(options, watchalive)
  }

  watchalive = {

    state: state,

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

    showUI: function(){
      showUI()
    },

    clearUI: function(){
      clearState()
    },

    clear: function(){
      clearState()
    },

    removeUI: removeUI,

    onFiles: function(handler){
      watchalive.on('files', handler)
    },
    connect: function(){
      setState({status: 'connected'})
    },
    disconnect: function(){
      setState({status: 'disconnected'})
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