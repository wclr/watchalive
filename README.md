# Watchalive!

> Serve, watch, compile sources, receive events/data and trigger custom actions in browsers.

## Features
- Serves development sources and assets using its own HTTP server.
- Watches file changes and sends the events/date to the client (default action on file change is page reload), using web sockets.
- Compiles (transpiles) resources and watches the dependencies for changes. Can be easily extended via transpile plugins. Currently bundled with LESS/CSS plugin out of the box.
- Can proxy and route requests or use custom middleware to handle requests.
- Fully configurable.

## State

It is in active development currently.
You can ask question on Gitter: [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/whitecolor/watchalive?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

## Installation and usage

> npm install watchalive

### Server side usage:

```javascript
var Watchalive = require('watchalive')

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

After this watchalive is available http://localhost:7000

This is a flat version of config (some options may overlap, use consciously). You can give more structure to it (see `Default Config`).



#### Command line usage

You may also install it globally to use from command line
> npm install watchalive -g

Usage:
> watchalive [options]

> watchalive --port 8000 --base /front-app

> watchalive --config myconfig.json

> watchalive myconfig.json

By default looks up 'watchalive.json' in working directory to use as config file.

#### Grunt/gulp task wrapper
> npm install watchalive-runner

Just pass your config as options to watchalive grunt/gulp task.
In grunt/gulp task there is available option `useGlobal` (`boolean, false`) tells if to use locally installed watchalive version or global one.
By default the tasks looks up for local watchalive package and falls back to global.


### Client side usage:

Watchalive client is not intended to do some client work (except page reload if needed), but rather to allow you handle server events and data, and do any custom actions you need.

By default client watchalive script is injected first in the head, that will make available global `watchalive` object in the page at load time.

You can configure it like:

```HTML
<script>

    watchalive.config({
        host: 'http://myserver.local:7001', // custom host if watchalive server is not on the same domain
        reload: true, // make page reload on any file changes received,
        console: ['error'] // intercept console `error` calls and sends it to the server
    })

    // you can manually handle file change data received from server
    watchalive.onFiles(function(changes){
        changes.forEach(function(file){
            if (/\.css$/.test(file)){
                // simple css link hot reload
                var sheets = document.getElementsByTagName("link");
                for (var i = 0; i < sheets.length; ++i) {
                    var elem = sheets[i];
                    var rel = elem.rel;
                    if (elem.href && rel == "stylesheet") {
                        var url = elem.href.replace(/\?\d+/, '');
                        if (url.lastIndexOf(file) + file.length == url.length){
                            elem.href = url + '?' + (new Date().valueOf());
                        }
                    }
                }
            } else {
                window.location.reload()
            }
        })
    })

</script>
```


## Default config
The default config gives you a <b>quick look</b> on all options and default values that will be merged with your config values.

```javascript
    var defaultConfig = {
        port: 7000, // port to serve files and handle socket connection
        base: process.cwd(), // base from where files are served and resolved
        stdin: true, // enable basic management via stdin commands
        debug: false, // output debug messages

        serve: {
            clientLibName: 'watchalive.js',
            injectScript: true, // inject client script in HTML automatically
            injectSocketIo: true, // if false won't load socket.io
            injectScriptTo: 'head', // where to inject script `head` or `body`
            transpile: {}, // enabled embedded and custom transpilers
            route:[], // additional flexible config for routes
            proxy: [], // proxy requests config (for example to API server)
            middleware: [], // middlewares for  express.js server (NOT IMPLEMENTED)
            favicon: 'favicon.png', // use standard express.js middleware to serve favicon
            http2: false, // enables HTTP2 server
            httpOptions: false // options to pass to HTTP server
        },
        watch: {
            dependencies: true, // watch for dependencies (of transpiled files)
            files: [], // additionally watch for matched files (NOT IMPLEMENTED)
            skip: [], // skip some files
            served: true, // watch for files served by HTTP server
            poolInterval: 200, // interval for pooling
            debounce: 100 // delay to handle multiple
        },
        clients: {
            badge: true, // show badge on client (NOT IMPLEMENTED, badge always shown)
            reload: false, // if clients should be reloaded on change events
            console: false, // should console be intercepted on clients
            allowMessages: true, // show custom message (NOT IMPLEMENTED)
            sendData: false // send changed files data to client
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

Base directory (root from where developers assets are served), this is also base directory for other relative paths in config.

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

###### clients.sendData, `Boolean`, `false`

Should or not changed files data be sent to client, if enabled file changes then are sent as array of `{file: ..., data: ...}`


### Routes

`serve.route` can be array of object `{path: ..., target: ...}, or simpleer: `{'path/url': 'target/url/file'}`

```javascript
route: [
    // simple map
    {'/': '/web/index.html'}, //when client requests `/` it recievs /web/index.html
    {path: '/mobile', target: '/mobile/index.html'}, // when client requests `/mobiled` it recievs /web/index.html

    // wildcard (only single supported)
    /mypackage/*': '/bower_components/mypackage/*'}, // everyting after mypackage/ will be mapped

    // parameters like :param
    {'/dist/:dest': '/:dest/index.dist.html'} // /dist/foo will be mapped to /foo/index.dist.html

    // regexp support in path
    {path: '^/[\\w\\d-]+(/[\\w\\d-]+)?$', regexp: 'i', target: '/web/index.html'}
]
```

When `path` value is of `string` type tend to be used to construct RegExp, you should provide `regexp` property with RegExp options, if no options you should provide empty string `regexp: ''`

### Proxies

`serve.proxy` can be array of object `{context: ...,  target: ...}`

`context` defines which request to watchalive server should be proxied

`target` is full host string value including protocol and port, it can be replaced with number of options including `port`, `protocol` and `host`

```javascript
proxy: [
    {context: '/api', port: 4000},
    {context: '/other-api', target: 'http://otherhost/api:9000'},
]
```
### Transpilers


Currently only LESS/CSS transpiler is included out of the box. When you request *.less file it will be converted to css and sent as CSS data.

You can easily add you custom transpilers like:

```javascript
transpilers: {
    sass: {
        pattern: '*.scss',
        transpileFile: function(filePath, cache, callback){
            // read file at filePath
            // parse it
            // cache contains all files data currently watched
            // call callback(err, data, deps)
            // deps is optional array of file dependencies (full paths)
        },
        // or (NOT IMPLEMENTED yet)
        transpile: function(source, cache, callback){

        }
    }
}
```



## License

MIT