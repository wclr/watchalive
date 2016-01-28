"use strict"

var colors = require('colors')

colors.setTheme({
  log: 'white',
  info: 'green',
  help: 'cyan',
  warn: 'yellow',
  debug: 'grey',
  error: 'red',
  util: 'blue'
});

var logTypes = ['debug', 'log', 'warn', 'info', 'error', 'util', 'help']

class Logger {

  constructor(options){

    this._handlers = []

    if (typeof options == 'string'){
      options = {prepend: options}
    }
    this.options = Object.assign({}, options)
    var self = this
    logTypes.forEach((type) => {
        this[type] = function() {
          if (!self.allowType(type)) return
          var args = Array.prototype.slice.call(arguments)
          //console.warn('loggleer', type, args)
          args.unshift(type)
          return this.output.apply(this, args)
        }
      })
  }

  allowType(type){
    var allowed = this.options.allowed
      || logTypes.slice(1)
    if (this.isDebug()){
      allowed.push('debug')
    }
    return allowed.indexOf(type) >= 0
  }

  isDebug (val){
    var isDebug = this.options.isDebug

    if (isDebug){
      return isDebug(val)
    }

    if (arguments.length){
      this.debug = val
    }

    return  this.options.debug
  }

  createNew (options){
    if (typeof options == 'string'){
      options = {prepend: options}
    }

    options = Object.assign({}, this.options, options, {
      // merge prepends with parent
      prepend: [this.prepend, options.prepend]
        .filter(p => p).join(' ')
    })

    var logger = new Logger(options)
    logger._parent = this
    return logger
  }

  on (type, handler, parent){
    this._handlers.push({
      type: type,
      handler: handler,
      parent: parent
    })
    //if (parent && this._parent){
    //  this._parent.on(type, handler, true)
    //}
  }

  trigger (type, args){
    this._handlers.filter(h => h.type == type)
      .forEach(h => h.handler(args))
  }

  output() {
    var args = Array.prototype.slice.call(arguments);
    var type = args.shift()
    var prepend = this.options.prepend

    args = args.map((m)=> {
      return (typeof m == 'string' && colors[type](m)) || m
    })
    prepend && args.unshift(`[${prepend}]`.grey);
    //console.log('logger output', type, args)
    if (!console[type]){
      type = 'log'
    }

    console[type].apply(console, args)

    this.trigger(type, args.map(a => a ? a.toString() : '').join(' '))
  }
}

module.exports = Logger