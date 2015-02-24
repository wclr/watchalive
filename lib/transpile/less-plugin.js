var fs = require('fs'),
    path = require('path'),
    less = require('less')

var Promise = require('bluebird');
Promise.promisifyAll(fs);

var LessPlugin = function(options){
    this.name = 'LessCss'
    this.options = options || {}
}

LessPlugin.prototype.match = function(fileName){
    return /\.less$/.test(fileName)
}

LessPlugin.prototype.transpileFile = function(filePath){

    var renderOptions = {
        paths: (this.options.paths || []).concat(path.dirname(filePath))
    }

    // TODO: use promisify
    return new Promise(function(resolve, reject){

        fs.readFileAsync(filePath, 'utf8').then(function(source){
            // TODO: maybe remove trycatch if no errors
            //trycatch(function(){
                less.render(source, renderOptions, function (err, output) {
                    if (err) {
                        console.error('Less plugin', filePath, err)
                        return reject(err)
                    }

                    resolve([output.css, output.imports, 'text/css'])
                    //resolve([tree.toCSS(), Object.keys(deps), 'text/css'])
                })
            //}, function(err){
            //    console.error('Less plugin', filePath, err)
            //    reject(err)
            //})
        }, reject)
    })
}

module.exports = LessPlugin