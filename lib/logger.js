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

class Logger {

  constructor(options){
    if (typeof options == 'string'){
      options = {prepend: options}
    }
    this.options = Object.assign({}, options)
    var self = this
      ;['log', 'warn', 'info', 'error', 'util', 'debug', 'help']
      .forEach((type) => {
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
      || ['log', 'warn', 'info', 'error', 'help', 'util']
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

    return new Logger(options)
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
  }
}

module.exports = Logger