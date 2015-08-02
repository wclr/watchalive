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

//if (!!global.gc) {
//    console.log('Garbage collector is available on global scope')
//    setInterval(function() {
//        try {
//            global.gc()
//        } catch (gcerr) {
//            console.log('Garbage collecting error', gcerr)
//        }
//    }, 1000 * 30)
//} else {
//    console.log('--expose-gc flag wasn\'t provided')
//}

function takeParamFromArgs(param){
    options[param] = argv[param] || argv[param[0]] || options[param]
}

;['base', 'port'].forEach(takeParamFromArgs)

var App = require('./lib/app.js')

var app = new App(options)

app.start()