var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    minimatch = require('minimatch'),
    mime = require('mime');

var Promise = require('bluebird');
Promise.promisifyAll(fs);

var Watcher = require('./watcher')


var matchPatterns = function(patterns, file){
    if (!patterns) return false
    if (typeof patterns == 'string') patterns = [patterns]
    for (var i = 0; i < patterns.length; i++){
        if (minimatch(file, patterns[i])){
            return true
        }
    }
    return false
}

var WatchStore = function(config){

    this.config = config
    
    if (config.watch){
        this.watcher = new Watcher(config.watch)
        this.config.skip = config.watch.skip
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

        //this.watcher.onChange(function(changedFiles){
        //
        //    changedFiles = handleDeps(changedFiles)
        //
        //    async.map(changedFiles, function(filePath, cb){
        //        var store = self._store[filePath]
        //        if (store){
        //            fs.readFile(filePath, 'utf-8', function(err, data){
        //                store.data = data
        //            })
        //        } else {
        //            cb(null, filePath)
        //        }
        //    })
        //
        //})

        this.watcher.onChange(function(changedFiles){

            changedFiles = handleDeps(changedFiles)

            async.map(changedFiles, function(filePath, cb){
                self.addFile(filePath, cb)
            }, function(err, changed){

                if (err){
                    console.error('Watch-store', err)
                    return
                }
                changed = changed.filter(function(ch){return ch})
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
        this._depsIndex = {}
        this.watcher.stop()
    },

    getTranspiler: function(filePath){
        var result
        this.transpilers.every(function(transpiler) {
            var match = transpiler.match && transpiler.match(filePath),
                patternMatch = match || matchPatterns(transpiler.pattern, path.basename(filePath))
            if (patternMatch){
                result = transpiler
            }
            return !result
        })
        return result
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
            self.watcher && self.watcher.add(d)
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

        //var addDeps = function(deps){
        //
        //    deps.forEach(function(depPath){
        //        //console.log('addDep', depPath)
        //        self.watcher.add(depPath)
        //        var dep = self._depsIndex[depPath] || []
        //        self._depsIndex[depPath] = dep
        //        if (dep.indexOf(filePath) < 0){
        //            dep.push(filePath)
        //        }
        //    })
        //}

        var self = this,
            transpiler = this.getTranspiler(filePath)

        if (transpiler) {
            var started = new Date()

            if (transpiler.__transpile){
                
                var source = this._store[filePath].data,
                    cache = {}
                for (var file in this._store){
                    cache[file] = this._store.data
                }
                
                transpiler.transpile(source, cache).spread(function (data, deps, contentType) {
                    self.modifyDeps(filePath, deps)
                    deps.forEach(function(){
                        
                    })
                    for (var file in cache){
                        if (!self._store[file]) {
                            self.addToStore(file, data, contentType)
                        }
                    }
                })
            } else if (transpiler.transpileFile){
                transpiler.transpileFile(filePath).spread(function (data, deps, contentType) {
                    deps = deps || []
                    //addDeps(deps)

                    if (self.config.debug){
                        var time = (new Date() - started) / 1000
                        if (time > 2.0) {
                            console.warn(transpiler.name + ' transpile:', self.relativeBase(filePath), 'transpiled in', time.toFixed(2), 'sec,', deps.length, 'deps')
                        }
                    }
                    var added = self.addToStore(filePath, data, contentType || transpiler.contentType)
                    self.modifyDeps(filePath, deps)
                    callback(null, added)
                }).catch(function (err) {
                    console.error(err)
                    callback(err)
                })
            } else {
                callback('Transpiler', transpiler.name || '' ,'has no methods to transpile.')
            }
        }

        return !!transpiler

    },

    doSkip: function(filePath){
        return matchPatterns(this.config.skip, this.relativeBase(filePath))
    },

    checkExistsInCache: function(filePath, data){
        var file = this._store[filePath]
        return this.cache && file && file.data === data
    },

    addToStore: function(filePath, data, contentType){

        if (this.checkExistsInCache(filePath, data)){
            console.warn('addToStore file', filePath, 'already exists in store with the same data')
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
                    console.error('watchStore error reading file', self.relativeBase(filePath))
                    return callback(err)
                }
                callback(null, self.addToStore(filePath, data, contentType))
            })
        }
    },

    getFileData: function(filePath, cb){
        this.getFile(filePath, function(err, file){
            cb(err, file && (file.transpiled || file.data))
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
                added && (added.requested = true)
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