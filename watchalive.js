var fs = require('fs'),
    cwd = process.cwd()

var configFileName = 'watchalive.json'

var options = {}

if (fs.existsSync(cwd + '/' + configFileName)){
    try {
        var fileConfig = JSON.parse(fs.readFileSync(cwd + '/' + configFileName))
        options = fileConfig
    } catch(e){
        console.log('Could parse watchalive configuration file', e)
    }
}

require('./lib/start.js')(options)