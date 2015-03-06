// Something definitely should be here..
var Watchalive = require('../index')

var wa = new Watchalive({
    port: 9001,
    base: __dirname,
    transpile: {
        less: true
    },
    route: [
        {'/web': '/web-route/index.html'},
        //{'/bootstrap/*': '/bower_components/bootstrap/*'},
        //{'/mobile': '/mobile/index.html'},
    ],
    reload: true,
    console: true,
    proxy: {context: '/api', port: 4000},
    skip: ['bower_components/*', 'node_modules/*', '**/favicon.png'],
})

wa.start()