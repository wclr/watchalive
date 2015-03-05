# Watchalive!

> Serve, watch, compile sources, receive events/data and trigger custom actions in browsers.

## Features
- Serves development sources and assets using its own HTTP server.
- Watches file changes and sends the events/date to the client (default action on file change is page reload), using web sockets.
- Compiles (transpiles) resources and watches the dependencies for changes. Can be easily extended via transpile plugins. Currently bundled with LESS/CSS plugin out of the box.
- Can proxy and route requests or use custom middleware to handle requests.
- Fully configurable.

## Installation and usage

> npm install watchalive

Usage is simple:

```javascript
var wa = new Watchalive({
    port: 7001,
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
    skip: ['bower_components/*', 'node_modules/*', '**/favicon.png'],
})

wa.start()
```

This is a flat version of config (some options may overlap, use consciously). You can give more structure to it (see `Default Config`).


## Command line usage

You may also install it globally to use from command line
> npm install watchalive -g

Usage:
> watchalive [options]

> watchalive --port 8000 --base /front-app

> watchalive --config myconfig.json

> watchalive myconfig.json

By default looks up 'watchalive.json' in working directory to use as config file.

## Grunt/gulp task wrapper
> npm install watchalive-runner

Just pass your config as options to watchalive grunt/gulp task.
In grunt/gulp task there is available option `useGlobal` (`boolean, false`) tells if to use locally installed watchalive version or global one.
By default the tasks looks up for local watchalive package and falls back to global.

## Default config
The default config gives you a <b>quick look</b> on all options and default values that will be merged with your config values.

```javascript
var defaultConfig = {
        port: 7000, // port to serve files and handle socket connection
        base: process.cwd(),
        stdin: true, // enable basic managment via stdin commands
        debug: false, // output debug messages

        serve: {
            clientLibName: 'watchalive.js',
            injectScript: true,
            injectSocketIo: true,
            injectScriptTo: 'head',
            transpile: {},
            route:[],
            proxy: [],
            middleware: [],
            favicon: 'favicon.png',
            http2: false,
            httpOptions: false
        },
        watch: {
            dependencies: true,
            files: [],
            skip: [],
            served: true,
            poolInterval: 200

        },
        clients: {
            badge: true,
            allowMessages: true,
            sendData: true
        }
    }
```


## Options

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

###### debug
type: `boolean`, default: `false`

Enable output of debug messages.

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

Inject socket.io injection (if you want to use your own socket.io, set to `false`).

WARNING: NOT IMPLEMENTED. Always injected.

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

###### serve.httpOptions
type: `boolean|object`, default: `false`

Custom HTTP/HTTP2 server options.

###### serve.http2
Type: `boolean`, default: `false`

Enables HTTP2 server! For convenience if `key` and `cert` are not passed in `httpOptions` sample self generated certificates are used.


-----

##### watch.skip
type: `boolean|string|array`, default: `false`

Minimatch pattern(s) to skip files. Pattern(s) will be match with file path relative to base directory (for example if you want to skip `favicon.png` from all paths use `**/favicon.png` pattern)

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

###### watch.poolInterval, `Number`, `200`

Interval to pool file system (`fs.watch` parameter)

###### clients.sendData, `Boolean`, `true`

Should or not changed files data be sent to client

## License

MIT