var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    minimatch = require('minimatch'),
    mime = require('mime');

var Promise = require('bluebird');
Promise.promisifyAll(fs);

var Watcher = require('./watcher')

var WatchStore = function(config){

    this.config = config
    
    if (config.watch){
        this.watcher = new Watcher(config.watch)
        this.config.skip = config.watch.skip
    }
    this.cache = true

    // _deps contains map of dependencies and its dependants
    this._deps = {}
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
                deps = self._deps

            files.forEach(function(file){
                var dep = deps[file]
                if (store[file]){newFiles.push(file)}

                dep && dep.forEach(function(d){
                    newFiles.indexOf(d) < 0 && newFiles.push(d)
                })

            })

            return newFiles
        }

        if (!this.watcher){
            return
        }

        this.watcher.onChange(function(changedFiles){

            changedFiles = handleDeps(changedFiles)

            async.map(changedFiles, function(filePath, cb){
                self.addFile(filePath, cb)
            }, function(err, changed){
                if (err){
                    console.error('Watch-store', err)
                    return
                }
                self.onChangeCallbacks.forEach(function(cb){
                    cb(changed)
                })
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
        this._deps = {}
        this.watcher.stop()
    },

    restart: function(){
        this.stop()
        this.start()
    },

    addWithTranspile: function(filePath, callback){

        var addDeps = function(deps){

            deps.forEach(function(depPath){
                //console.log('addDep', depPath)
                self.watcher.add(depPath)
                var dep = self._deps[depPath] || []
                self._deps[depPath] = dep
                if (dep.indexOf(filePath) < 0){
                    dep.push(filePath)
                }
            })
        }

        var self = this,
            handled = false

        this.transpilers.every(function(transpiler){
            if (transpiler.match(filePath)){
                var started = new Date()
                transpiler.transpileFile(filePath).spread(function(data, deps, contentType){
                    deps = deps || []
                    addDeps(deps)
                    var time = (new Date() - started)/1000
                    if (time > 2.0){
                        console.warn(transpiler.name + ' transpile:', self.relativeBase(filePath), 'transpiled in', time.toFixed(2), 'sec,', deps.length, 'deps')
                    }
                    callback(null, self.addToStore(filePath, data, contentType))
                }).catch(function(err){
                    console.error(err)
                    callback(err)
                })
                handled = true
            }
            return !handled
        })

        return handled
    },

    doSkip: function(filePath){
        var relativeBase = this.relativeBase(filePath)
        if (this.config.skip){
            var patterns = this.config.skip
            for (var i = 0; i < patterns.length; i++){
                if (minimatch(relativeBase, patterns[i])){
                    return true
                }
            }
        }
        return false
    },

    addToStore: function(filePath, data, contentType){

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

    addFile: function(filePath, callback){
        var self = this
        var contentType = mime.lookup(filePath)
        if (!this.addWithTranspile(filePath, callback)){
            var encoding = mime.charsets.lookup(contentType)
            fs.readFile(filePath, encoding, function(err, data){
                if (err){
                    console.error('watchStore.addFile: error reading file', filePath, err)
                    return callback(err)
                }
                callback(null, self.addToStore(filePath, data, contentType))
            })
        }
    },

    getFileData: function(filePath, cb){
        this.getFile(filePath, function(err, file){
            cb(err, file && file.data)
        })
    },

    getFile: function(filePath, cb){

        filePath = this.resolveBase(filePath)

        if (this.doSkip(filePath)){
            return cb(null, null)
        }

        var self = this

        var stored = self._store[filePath]
        if (stored){
            cb(null, stored)
        } else {
            this.addFile(filePath, function(err, added){
                cb(err, added)
            })
        }
    },

    remove: function(filesToRemove){
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