var fs = require('fs'),
    path = require('path'),
    less = require('less'),
    lessCachePlugin = require('./less-cache-plugin')

var Promise = require('bluebird');
///Promise.promisifyAll(fs);

var LessPlugin = function(options){
    this.name = 'LessCss'
    this.options = options || {}
    this.useCache = true
    this.contentType = 'text/css'
}

LessPlugin.prototype.match = function(fileName){
    return /\.less$/.test(fileName)
}

LessPlugin.prototype.getRenderOptions = function(filePath){
    var options = {}
    for (var prop in this.options){
        options[prop] = this.options[prop]
    }
    options.paths = (options.paths || []).concat(path.dirname(filePath))
    return options
}

LessPlugin.prototype.transpileFile = function(filePath){

    var renderOptions = this.getRenderOptions(filePath)

    return new Promise(function(resolve, reject){

        fs.readFile(filePath, 'utf8', function(err, source){
                if (err){
                    return reject(err)
                }
                less.render(source, renderOptions, function (err, output) {
                    if (err) {
                        console.error('Less plugin', filePath, err)
                        return reject(err)
                    }
                    resolve([output.css, output.imports, 'text/css'])
                })
        })
    })
}

LessPlugin.prototype.transpile = function(source, cache){

    var renderOptions = this.getRenderOptions(filePath)

    if (cache){
        renderOptions.plugins = [lessCachePlugin(cache)]
    }

    return new Promise(function(resolve, reject){

            less.render(source, renderOptions, function (err, output) {
                if (err) {
                    console.error('Less plugin', filePath, err)
                    return reject(err)
                }

                resolve([output.css, output.imports, 'text/css'])
                //resolve([tree.toCSS(), Object.keys(deps), 'text/css'])
            })

    })
}


module.exports = LessPlugin