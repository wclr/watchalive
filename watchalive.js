#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    cwd = process.cwd(),
    argv = require('yargs').argv;


var configFileName = path.resolve(cwd, argv.config || argv._[0] || 'watchalive.json')

var options = {}

if (fs.existsSync(configFileName)){
    try {
        console.log('Reading configuration file', configFileName)
        var fileConfig = JSON.parse(fs.readFileSync(configFileName))
        options = fileConfig
    } catch(e){
        console.log('Could parse watchalive configuration file', e)
    }
}

function takeParamFromArgs(param){
    options[param] = argv[param] || argv[param[0]] || options[param]
}

;['base', 'port'].forEach(takeParamFromArgs)

require('./lib/start.js')(options)