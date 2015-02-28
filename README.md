# Watchalive!

> Serve, watch, compile sources, receive events/data and trigger custom actions in browsers.

## Features
- Serves development sources and assets using its own HTTP server.
- Watches file changes and sends the events/date to the client (default action on file change is page reload), using web sockets.
- Compiles (transpiles) resources and watches the dependencies for changes. Can be easily extended via transpile plugins. Currently bundled with LESS/CSS plugin out of the box.
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
        injectScriptTo: 'body',
        injectSocketIo: false
        transpile: {
            less: true,
            custom: {
                name: 'My custom transpiler',
                pattern: '*.custom',
                match: function(filePath){
                    return /\.custom$/.test(filePath)
                },
                transpileFile: function(filePath, callback){
                    //...
                }
            }
        },
        route: [
            {'/': '/web/index.html'},
            {'/bootstrap/*': '/bower_components/bootstrap/*'},
            {'/mobile': '/mobile/index.html'},
            {'/dist/:dest': '/:dest/index.dist.html'},
            {path: '^/[\\w\\d-]+(/[\\w\\d-]+)?$', regexp: 'i', target: '/web/index.html'}
        ],
        proxy: [
            {context: '/api', port: 4000}
        ],
        middleware: [{function(req, res, next){
            //....
        }],
        favicon: true
    },
    watch: {
        served: true,
        dependencies: false,
        skip: ['bower_components/*', 'jspm_packages/*', 'node_modules/*'],
        debounce: 200,
        poolInterval: 200
    },
    clients: {
        badge: false,
        sendData: false
    }
})

wa.start()
```

You can also use plain config version:

```javascript
var wa = new Watchalive({
    port: 7000,
    base: __dirname,
    transpile: {
        less: true
    },
    route: [
        {'/': '/web/index.html'},
        {'/bootstrap/*': '/bower_components/bootstrap/*'},
        {'/mobile': '/mobile/index.html'},
    ],
    proxy: {context: '/api', port: 4000},
    skip: ['bower_components/*', 'node_modules/*'],
})
```

You may also install it globally to use from command line
> npm install watchalive -g

Grunt/gulp task wrapper (works with locally or globally installed versions)
> npm install watchalive-runner


##### Options

###### port
Type: `Number`
Default value: `7000`

Port for running Express server and sockets endpoint

###### base
Type: `String`
Default value: `process.cwd()`

Base directory (root from where developers assets are served)

###### stdin
Type: `Boolean`
Default value: `true`

Enable commands via standard input

-----

###### serve
Type: `Boolean|Object`
Default value: `true`

Sets serving rules. If `true` then `default` options are used. If `false` disable files serving.

###### serve.clientLibName
Type: `String`
Default value: `watchalive.js`

Name of client script to load via script tag.

###### serve.injectScript
Type: `Boolean`
Default value: `true`

Enable automatic injection of client script tag in HTML.

###### serve.injectSocketIo
Type: `Boolean`
Default value: `true`

Inject socket.io injection (if you want to use your own soket.io, set to `false`).

###### serve.injectScriptTo
Type: `String`
Default value: `head`

Two values are possible: `head` or `body`

###### serve.transpile
Type: `Object`

See `transpile` instructions.

###### serve.route
Type: `Array|Object`

See `route` instructions.

###### serve.proxy
Type: `Array|Object`

See proxy instructions.

-----

##### watch.skip
Type: `Boolean|String|Array`
Default value: `false`

Minimatch pattern(s) to skip files (pattern will be match with file path relative to base directory)

##### watch.files
Type: `Boolean|String|Array`
Default value: `false`

Minimatch pattern(s) to add files to watch (pattern will be match with file path relative to base directory)

WARNING: NOT IMPLEMENTED.

##### watch.served
Type: `Boolean`
Default value: `true`

Watch served files by HTTP server (with respect to `skip` option)

##### watch.dependencies
Type: `Boolean`
Default value: `true`

Watch the files dependencies of transpiled sources (`skip` option is not considered)

##### watch.debounce
Type: `Number`
Default value: `100`

Delay before change event is called (helps to prevent multiple change events for many successive file system events)

####### watch.poolInterval, `Number`, `200`

Interval to pool file system (`fs.watch` parameter)

####### clients.sendData, `Boolean`, `true`

Should or not changed files data be sent to client

## License

MIT