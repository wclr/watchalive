module.exports = {
  port: process.env.PORT || 7000, // port to serve files and handle socket connection
  base: process.cwd(), // base from where files are served and resolved
  stdin: true, // enable basic management via stdin commands
  debug: false, // output debug messages

  serve: {
    clientLibName: 'watchalive.js',
    injectScript: true, // inject client script in HTML automatically
    injectSocketIo: true, // if false won't load socket.io
    injectScriptTo: 'head', // where to inject script `head` or `body`
    transpile: {}, // enabled embedded and custom transpilers
    route: [], // additional flexible config for routes
    defaultRoute: '',
    proxy: [], // proxy requests config (for example to API server)
    middleware: [], // middlewares for  express.js server (NOT IMPLEMENTED)
    favicon: 'favicon.png', // use standard express.js middleware to serve favicon
    http2: false, // enables HTTP2 server (experimental)
    httpOptions: false, // options to pass to HTTP server,
    mime: {} // custom defined mime types: https://github.com/broofa/node-mime
  },
  watch: {
    dependencies: true, // watch for dependencies (of transpiled files)
    skip: [], // skip some files
    skipExcept: [], // exclude from skip some files
    served: true, // watch for files served by HTTP server
    usePolling: false, //chokidar usePooling
    poolInterval: 200, // interval for pooling
    debounce: 100 // delay to handle multiple
  },
  clients: {
    ui: true, // show ui badge on client
    reload: true, // if clients should be reloaded on change events
    console: false, // should console be intercepted on clients
    data: false // the same is sendData
  },
  plugin: [] // plugin modules to attach
}