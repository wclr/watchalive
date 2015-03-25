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
        options = JSON.parse(fs.readFileSync(configFileName))
        options.port = process.env.PORT || options.port // minihost sets it's own port
    } catch(e){
        console.log('Could parse watchalive configuration file', e)
    }
}

function takeParamFromArgs(param){
    options[param] = argv[param] || argv[param[0]] || options[param]
}

;['base', 'port'].forEach(takeParamFromArgs)

var App = require('./lib/app.js')

var app = new App(options)

app.start()
