# Watchalive!

> Serve, watch, compile sources, receive events/data and trigger custom actions in browsers.

## Features
- Serves development sources and assets using its own HTTP server.
- Watches file changes and sends the events/date to the client (default action on file change is page reload), using web sockets.
- Compiles resources and watches the dependencies for changes. Currently supports LESS/CSS compilation out of the box, and can be extended easily via plugins.
- Can proxy and route requests or use custom middleware to handle requests.
- Fully configurable.

## Installation

> npm install watchalive

Example of usage:

```javascript
var Watchalive = require('watchalive')

var wa = new Watchalive({
    port: 7000,
    base: __dirname,
    stdin: true,
    serve: {
        clientLibName: 'watchilve-custom.js',
        injectScript: true,
        injectSocketIo: false
        plugins: {
            less: true,
            custom: {
                name: 'My custom plugin',
                pattern: '*.custom',
                check: function(filePath){
                    return /\.custom$/.test(filePath)
                },
                parse: function(filePath, callback){
                    //...
                },
                parseSource: function(source, cache, callback){
                    //...
                }
            }
        },
        routes: [
            {'/': '/web/index.html'},
            {'/bootstrap/*': '/bower_components/bootstrap/*'},
            {'/mobile': '/mobile/index.html'},
            {'/dist/:dest': '/:dest/index.dist.html'},
            {path: '^/[\\w\\d-]+(/[\\w\\d-]+)?$', regexp: 'i', target: '/web/index.html'}
        ],
        proxies: [
            {context: '/api', port: 4000}
        ],
        middlewares: [{function(req, res, next){
            //....
        }],
        favicon: true
    },
    watch: {
        served: true,
        dependencies: false,
        files: [],
        skip: ['bower_components/*', 'jspm_packages/*', 'node_modules/*']
    },
    clients: {
        badge: false,
        sendData: false
    }
})

wa.start()
```

You may also install it globally to use from command line
> npm install watchalive -g

Grunt/gulp task wrapper (works with locally or globally installed versions)
> npm install watchalive-runner

## License

MIT