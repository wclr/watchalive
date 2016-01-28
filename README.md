## Watchalive.

A small but robust dev server with smart file watching and transform support.

### Generally:
- http serving server (express)
- lean and smart file watcher (chokidar)
- socket.io server and client

### Other useful stuff:
- watch only served (requested by client) files, client gets notified about changes
- transforms (transpiles/builds) files using simple plugins
- can have custom routes
- proxies requests

### Usage

- npm install watchalive -g (CLI, preferred usage)

Place `watchalive.config.js` (or just `watchalive.js` or `wa.config.js` as you like) in your project folder. 
Run `"watchalive"` from cmd line.

Example configuration file (loading React.js transformed files with SystemJS loader):

```javascript
"use strict"
var babel = require('babel-core')

module.exports = {
    debug: true, // debug mode
    base: "..", // base serve directory
    skip: [/node_modules/], // won't watch, cache and transpile
    // transformer plugins 
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
 > watchalive --port 7007

### API Usage

- npm install watchalive

```javascript
"use strict"
const Watchalive = require('watchalive')
 
var wa = new Watchalive({/*config */})

wa.start()
```

[Deep dive into options!](lib/default-config.js) 