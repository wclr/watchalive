#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    argv = require('yargs').argv;

var configPaths = [
    path.resolve(argv.config || argv._[0] || 'watchalive.json'),
    path.resolve('watchalive.js'),
    path.resolve('package.json')
]

var getConfig = function(configPath){

    try {
        console.log('Reading configuration file', configPath)
        var config = require(configPath)
        return /package\.json/.test(configPath) ? config.watchalive : config
    } catch(e){
        console.log('Could not parse watchalive configuration file', e)
    }
}


var config

configPaths.every(function(configPath){
    if (fs.existsSync(configPath)){
        config = getConfig(configPath)
    }
    return !config
})

config = config || {}

for (var arg in argv){
    if (arg !== '_'){
        config[arg] = argv[arg]
    }
}

var App = require('./lib/app.js')

var app = new App(config)

app.start()