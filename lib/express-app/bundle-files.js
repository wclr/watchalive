var async = require('async'),
    fs = require('fs'),
    util = require('util'),
    path = require('path')

module.exports = function(options){

    if (util.isArray(options)){
        options = {
            files: options
        }
    }

    return function(req, res){
        res.setHeader('Content-Type', options.contentType || 'text/javascript')

        options.wrap && res.write(';(function(){')

        var files = options.files || []
        var dir = options.dir !== undefined ? options.dir : 'client'

        dir && (dir = '/' + dir)

        async.forEachSeries(files, function(file, done){
            file = __dirname + dir + '/' + file
            fs.readFile(file, function(err, data){
                if (err){
                    res.write('// Error reading ' + file + ': ' + err)
                }else{
                    res.write('\n//============== ' + path.basename(file) + ' ==================\n\n')
                    res.write(data)
                }
                done()
            })
        }, function(){
            options.wrap && res.write('}());')
            res.end()
        })
    }
}