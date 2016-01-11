var fs = require('fs'),
  path = require('path'),
  async = require('async'),
  minimatch = require('minimatch'),
  mime = require('mime'),
  util = require('util')

var Promise = require('bluebird');
Promise.promisifyAll(fs);

var Watcher = require('./watcher')


var matchPatterns = function(patterns, file){

  if (!util.isArray(patterns)){
    patterns = [patterns]
  }

  return patterns.reduce(function(prev, pattern) {
    if (prev || !pattern) return prev
    if (pattern instanceof RegExp){
      return pattern.test(file)
    } else if (typeof pattern == 'function'){
      return pattern(file)
    } else{
      return minimatch(file, pattern)
    }
  }, false)
}

var WatchStore = function(config){

  this.config = config
  this.logger = config.logger

  if (config.watch){

    this.watcher = new Watcher(Object.assign({
      logger: this.logger.createNew('FileWatcher')
    }, config.watch))

    this.config.skip = config.watch.skip
    this.config.skipExcept = config.watch.skipExcept

  }
  this.cache = true

  // _deps contains map of dependencies and its dependants
  this._depsIndex = {}
  this._store = {}

  this.onChangeCallbacks = []

  this.transpilers = config.transpile

  this.getFile = Promise.promisify(this.getFile, this)
  this.getFileData = Promise.promisify(this.getFileData, this)
}


WatchStore.prototype = {

  start: function(){
    var self = this

    var handleDeps = function(files){

      var newFiles = [],
        store = self._store,
        depsIndex = self._depsIndex

      files.forEach(function(file){
        var depIndexObj = depsIndex[file] || {}
        if (store[file]){newFiles.push(file)}

        Object.keys(depIndexObj).forEach(function(d){
          newFiles.indexOf(d) < 0 && newFiles.push(d)
        })

      })

      return newFiles
    }

    var getFilesTranspile = function(files){

      var toTranspile = [],
        store = self._store

      files.forEach(function(file){

        if (store[file] && store[file].transpiled){toTranspile.push(file)}

        // add dependants
        var dep = self._depsIndex[file]
        dep && dep.forEach(function(d){
          toTranspile.indexOf(d) < 0 && newFiles.push(d)
        })

      })

      return newFiles
    }

    if (!this.watcher){
      return
    }

    this.watcher.onChange((changedFiles) => {

      changedFiles = handleDeps(changedFiles)

      async.map(changedFiles, (filePath, cb) => {
        //self.removeFromStore(filePath)
        self.addFile(filePath, cb)
      }, (err, changed) => {
        if (err){
          return this.logger.error('Watch-store', err)

        }
        changed = changed.filter(ch => ch)
        changed.length && self.onChangeCallbacks
          .forEach(cb => cb(changed))
      })
    })

    this.watcher.start()
  },

  pause: function(){

    this.watcher && this.watcher.pause()
  },

  stop: function(){
    if (!this.watcher){
      return
    }
    this._store = {}
    this._depsIndex = {}
    this.watcher.stop()
  },

  getTranspilers: function(filePath){
    return this.transpilers.filter(function(transpiler) {
      var baseName = path.basename(filePath)

      if (transpiler.pattern){
        return matchPatterns(transpiler.pattern, baseName)
      }
      var match = transpiler.match || transpiler.test

      if (!util.isArray(match)){
        match = [match]
      }

      return match.reduce(function(prev, match){
        if (prev) return prev

        if (match instanceof RegExp){
          return match.test(filePath)
        }

        if (typeof match == 'function'){
          return match.apply(transpiler, [filePath])
        }

        if (typeof match == 'string') {
          try {
            return matchPatterns(match, baseName)
              || new RegExp(match.test(filePath))
          } catch (e) {
            return false
          }
        }
        return false

      }, false)
    })
  },

  modifyDeps: function(filePath, newDeps){

    if (!newDeps || !newDeps.length){
      return
    }

    var fileStore = this._store[filePath],
      depsIndex = this._depsIndex,
      newDepsObj = {}

    var self = this

    newDeps.forEach(function(d){
      var depIndexObj = depsIndex[d] || {}
      depIndexObj[filePath] = true
      newDepsObj[d] = true
      depsIndex[d] = depIndexObj
      self.watcher && !self.shouldSkipWatch(d) && self.watcher.add(d)
    })

    // remove old deps from depsIndex
    // TODO: Remove from watch empty deps
    fileStore.deps && fileStore.deps.forEach(function(d){
      // in no dep in newDeps, remove from depsIndex
      var depIndexObj = depsIndex[d]
      if (depIndexObj && !newDepsObj[d]){
        depIndexObj[filePath] = undefined
      }
    })

    fileStore.deps = newDeps
  },

  addWithTranspile: function(filePath, callback){

    var self = this,
      transpilers = this.getTranspilers(filePath),
      transpiler = transpilers[0]

    if (!transpiler){
      return false
    }

    var called = false


    var transformHandler = function (err, result) {
      called = true
      if (err){
        console.error('Error while transform', err)
        return callback(err)
      }

      var data = result, deps = [], contentType

      if (util.isArray(result)){
        data = result[0]
        deps = result[1]
        contentType = result[2]
      } else if (typeof result == 'object'){
        data = result.data || ''
        deps = result.deps || deps
        contentType = result.contentType
      }

      //if (self.config.debug){
      //    var time = (new Date() - started) / 1000
      //    if (time > 2.0) {
      //        console.warn(transpiler.name + ' transpile:', self.relativeBase(filePath), 'transpiled in', time.toFixed(2), 'sec,', deps.length, 'deps')
      //    }
      //}

      if (!data && source){
        console.warn('Transpiler returned an empty source for', filePath)
      }

      var added = self.addToStore(filePath, data, contentType || transpiler.contentType)
      self.modifyDeps(filePath, deps)
      callback(null, added)
    }

    var transform = transpiler.transform || transpiler.transpile
    var transformFile = transpiler.transformFile || transpiler.transpileFile

    var args
    var source

    var applyTransform = function(){
      args = [source || filePath]

      if (transpiler.cache){
        var cache = {}
        // clone cache, should be optimized
        for (var file in this._store){
          cache[file] = this._store.data
        }
      }

      args.push(transformHandler)
      var result
      try {
        result = transform.apply(transpiler, args)
      } catch(e){
        console.error('Transform error', e)
      }

      if (result && result.then){
        result.then(function(result){
          transformHandler(null, result)
        }, transformHandler)
      } else if (result && !called){
        transformHandler(null, result)
      }
    }

    if (transformFile){
      transform = transformFile
      applyTransform()
    } else if (transform){
      //TODO: if dep was changed  not file itself
      // we will read the same version (not big deal)
      // think how to optimize
      //source = this._store[filePath] && this._store[filePath].data
      if (source){
        applyTransform()
      } else {
        this.readFileCorrectly(filePath, function(err, data){
          if (err){
            return callback(err)
          }
          source = data
          applyTransform()
        })
      }
    } else {
      return false
    }

    return true
  },

  shouldSkipWatch: function(filePath){
    var relative = this.relativeBase(filePath)
    return matchPatterns(this.config.skip, relative)
      && !matchPatterns(this.config.skipExcept, relative)
  },

  resolveBase: function(file){
    // check if url
    if (file[0] == '/'){
      file = file.slice(1)
    }
    return this.config.base ? path.resolve(this.config.base, file) : file
  },

  relativeBase: function(filePath){
    return (this.config.base ? path.relative(this.config.base, filePath) : filePath).replace(/\\/g, '/')
  },

  readFileCorrectly: function(filePath, callback){
    fs.stat(filePath, function(err, stat){
      if (stat && !stat.isDirectory()){
        var contentType = mime.lookup(filePath)
        var encoding = mime.charsets.lookup(contentType) || 'utf-8'
        fs.readFile(filePath, encoding, callback)
      } else {
        callback(err)
      }
    })
  },

  //// to get rid of fake change events
  //addFileIfChanged: function(filePath, callback){
  //  var oldData = this._store[filePath] && this._store[filePath].data
  //  this.addFile(filePath, function(err, added){
  //
  //  })
  //},

  checkExistsInCache: function(filePath, data){
    var file = this._store[filePath]
    return this.cache && file && file.data === data
  },

  addToStore: function(filePath, data, contentType){

    if (this.checkExistsInCache(filePath, data)){
      this.logger.warn('addToStore file', filePath, 'already exists in store with the same data')
      return false
    }

    var file = {
      path: filePath,
      relativeBase: this.relativeBase(filePath),
      contentType: contentType || mime.lookup(filePath),
      data: this.cache && data
    }

    this._store[filePath] = file
    this.watcher.add(filePath)
    return file
  },

  addFile: function(filePath, callback){

    if (!this.addWithTranspile(filePath, callback)){
      this.readFileCorrectly(filePath, (err, data) => {
        if (err){
          if (path.extname(filePath) && path.basename(filePath) !== 'favicon.ico'){
            this.logger.warn('Could not read probably file', filePath, err.code)
          } else {
            this.logger.debug('Could not read file', filePath, err.code)
          }
          return callback(null, null)
        }
        callback(null, this.addToStore(filePath, data))
      })
    }
  },

  getFileData: function(filePath, cb){
    return this.getFile(filePath, (err, file) => {
      cb(err, file && (file.transpiled || file.data))
    })
  },

  getFile: function(filePath, cb){

    filePath = this.resolveBase(filePath)

    if (this.shouldSkipWatch(filePath)){
      return cb(null, null)
    }

    var self = this

    var stored = self._store[filePath]
    if (stored){
      cb(null, stored)
    } else {
      this.addFile(filePath, function(err, added){
        added && (added.requested = true)
        cb(err, added)
      })
    }
  },

  getCachedData: function(filePath){
    if (filePath instanceof RegExp){
      filePath = this.getWatched(filePath)[0]
    }
    if (this._store[filePath]){
      return this._store[filePath].data
    }
  },

  getWatched: function(){
    return this.watcher.getWatched.apply(this.watcher, arguments)
  },

  removeFromStore: function(filePath){
    delete this._store[filePath]
  },

  onChange: function(cb){
    if (this.onChangeCallbacks.indexOf(cb) < 0){
      this.onChangeCallbacks.push(cb)
    }
  },

  offChange: function(cb){
    var index = this.onChangeCallbacks.indexOf(cb)
    if (index >= 0){
      this.onChangeCallbacks.splice(index, 1)
    }
  }
}

module.exports = WatchStore