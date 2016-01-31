# Watchalive.

A small but **robust dev server** with smart file watching and transform support.

## Generally:
- http express server
- lean and smart file watcher
- socket.io server and client

## Useful features:
- watches only served (requested by client) files
- transforms (transpiles/compiles) files on the fly using simple plugins
- handles custom routes
- proxies requests to other services
- client gets notified about changes including changed sources

## Usage (CLI)

```bash
npm install watchalive -g
```

Place `watchalive.config.js` (or just `watchalive.js` or `wa.config.js` as you like) in your project folder. 
Run `"watchalive"` from command line.

Example configuration file (loading React.js transformed files with SystemJS loader):

```javascript
"use strict"
var babel = require('babel-core')

module.exports = {
    base: "..", // base serve directory, relative to process.cwd()
    skip: [/node_modules/], // won't watch, cache and transpile     
    plugin: [
        ["less", {paths: ['client']}], // standard less/css plugin
        [/\.js$/, (source) => // custom transformer
              babel.transform(source, {
                  presets: ["es2015", 'react'],
                  plugins: [
                      ['react-transform', {
                          transforms: [
                              {transform: 'react-transform-jspm-hmr'}
                          ]
                      }]
                  ]
              }).code 
        ]
    ],
    // advanced routing
    route: [
        {'/mobile': '/client/mobile/index.html'},
        {'*': '/client/web/index.html'}
    ],
    // flexible proxy config
    proxy: {
        '/api': 'my-app.dev:2000'
    },
    data: true // send source of changed file with notification message 
}
```
 
 You can also place config in `package.json` in `"watchalive"` section.
 
 Also you can run without config file:
 ```bash
 watchalive --port 7007 --base ..
 ```

### API usage

```bash
npm install watchalive
```

```javascript
"use strict"
const Watchalive = require('watchalive')
 
var wa = new Watchalive({/*config */})

wa.start()
```

[Deep dive into options!](lib/default-config.js)

### Client side usage
By default served *.html files get `watchalive.js` client script injected.
You can easily access to this notifications in code:
```javascript
    watchalive.onFiles(function(changes){
        // *changes* contain array of file names changed
        // can also contain changed file sources {file: ..., data: ...}
    })
``` 

### Examples of usage
- [CanJS hot reloading](https://github.com/whitecolor/can-hot)
- [Hot reloading with Steal-HMR](https://github.com/whitecolor/steal-hmr)

### Licence
MIT