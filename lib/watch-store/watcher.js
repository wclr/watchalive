var fs = require('fs'),
    path = require('path')

var Watcher = function(config){

    this.bounce = 200
    this.poolInterval = 200
    this.files = []
    this.onChangeCallbacks = []
    this.changeTimeout = 100
    this._changed = {}

    this.state = 'stopped'
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
        this.files.forEach(function(file){
            fs.unwatch(file.path, file.handler)
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
        var self = this
        this._changeTimer
        files.forEach(function(filePath){
            if (self.files.indexOf(filePath) === -1) {
                var handler = function (cur) {
                    if (self.state != 'active') return
                    self._changed[filePath] = true
                    clearTimeout(self._changeTimer)
                    self._changeTimer = setTimeout(function(){
                        self.trigger()
                    }, self.changeTimeout)


                }
                self.files.push({path: filePath, handler: handler})
                fs.watch(filePath, {interval: self.poolInterval}, handler)
            }
        })

    },

    has: function(filePath){
        var has = false
        this.files.every(function(file){
            return !(has = file.path == filePath)
        })
        return has
    },

    remove: function(filesToRemove){
        if (typeof filesToRemove == 'string'){
            filesToRemove = [filesToRemove]
        }
        for (var i = this.files.length - 1; i >= 0; i--){
            var file = this.files[i]
            if (filesToRemove.indexOf(file.path) >= 0){
                fs.unwatch(file.path, file.handler)
            }
            this.files.splice(i, 1)
        }

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