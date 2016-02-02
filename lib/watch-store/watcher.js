"use strict"

var fs = require('fs'),
  path = require('path')

var chokidar = require('chokidar');

var Watcher = function(config){

  this.debounce = config.debounce || 100
  this.poolInterval = config.poolInterval || 200
  this.files = []
  this._index = {}
  this.onChangeCallbacks = []
  this._changed = {}
  this.logger = config.logger

  this.state = 'stopped'

  this._watcher = chokidar.watch('', {
    //ignored: /[\/\\]\./,
    persistent: true,
    usePolling: config.usePolling
  });

  this.eventLog = []

  this._watcher.on('all', (event, filePath) => {
    // shrink event log
    if (this.eventLog.length > 200){
      this.eventLog.splice(0, 100)
    }
    this.eventLog.push({date: new Date(), event: event, file: filePath})

    if (!this.isWatched(filePath)){
      this.logger.debug(`File is NOT watched after ${event} event:`, filePath)
      // TODO: checkExist?
      this._watcher.add(filePath)
    }

    if (event !== 'change' && event !== 'unlink') return

    this.logger.debug(`${event} `, filePath, 'state', this.state)

    if (this.state != 'active') return
    this._changed[filePath] = true
    clearTimeout(this._changeTimer)
    this._changeTimer = setTimeout(() => {
      this.trigger()
    }, this.debounce)
  })
}


Watcher.prototype = {

  start: function(){
    this.state = 'active'
  },

  pause: function(){
    this.state = 'paused'
    clearTimeout(this._changeTimer)
  },

  stop: function(){
    this.state = 'stopped'
    clearTimeout(this._changeTimer)
    this._changed = {}
    this.unwatchAll()
  },

  unwatchAll: function(){
    var self = this
    this.files.forEach(function(file){
      self._watcher.unwatch(file.path)
    })
    this.files = []
  },

  trigger: function(){
    var self = this
    this.onChangeCallbacks.forEach(function(cb){
      cb(Object.keys(self._changed))
    })
    self._changed = []
  },

  add: function(files){
    if (typeof files == 'string'){
      files = [files]
    }

    files.forEach((filePath) => {
      if (!this._index[filePath]) {
        this.files.push({path: filePath})
        this._index[filePath] = true
        //self._watcher.unwatch(filePath)
        this._watcher.add(filePath)
      } else {
        this.logger.debug('Skip add already indexed', filePath,
          ', watching', this.isWatched(filePath))
      }
    })
  },

  has: function(filePath){
    return !!this._index[filePath]
  },

  remove: function(filesToRemove){
    if (typeof filesToRemove == 'string'){
      filesToRemove = [filesToRemove]
    }
    for (var i = this.files.length - 1; i >= 0; i--){
      var file = this.files[i]
      if (filesToRemove.indexOf(file.path) >= 0){
        this._watcher.unwatch(file.path)
      }
      this.files.splice(i, 1)
      delete this._index[filePath]
    }

  },

  getWatched: function(filter){
    var watched = this._watcher.getWatched()
    if (filter){
      // return array of filtered
      return Object.keys(watched).reduce((found, dir) => {
        return found.concat(
          watched[dir].filter(fileName => {
            let joined = path.join(dir, fileName)
            return typeof filter == 'string'
              ? path.relative(joined, filter) === ''
              : (filter instanceof RegExp)
                ? filter.test(joined)
                : false
          }).map(fileName => path.join(dir, fileName))
        )
      }, [])
    } else {
      return watched
    }
  },

  isWatched: function(filter){
    //var dir = path.dirname(filePath).toLowerCase()
    return !!this.getWatched(filter).length
  },

  onChange: function(cb){
    this.onChangeCallbacks.push(cb)
  },

  offChange: function(cb){
    var index = this.onChangeCallbacks.indexOf(cb)
    if (index + 1){
      this.onChangeCallbacks.splice(index, 1)
    }
  }

}

module.exports = Watcher