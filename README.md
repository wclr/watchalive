## Watchalive.

A small dev server with smart file watching and transform support.

### Generally:
- http serving server (express)
- lean and smart file watcher (chokidar)
- socket.io server and client

### Other useful stuff:
- watch only served (requested by client) files, client gets notified about changes
- transforms (transpiles/builds) files using simple plugins
- can have custom routes
- proxies requests

### Installation and usage

- npm install watchalive
- npm install watchalive -g (if want to use as CLI)

Example configuration file (for using with SystemJS loader):

```javascript
var babel = require('babel-core')

module.exports = {
    debug: true, // debug mode
    base: "..", // base serve directory
    skip: [/node_modules/], // won't watch, cache and transpile
    // transformer plugins 
    plugin: [
        ["less", {paths: ['client']}], // standard less plugin
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
    data: true
}
```

[Deep dive in options!](lib/config.js#L51) 