var path = require('path')
var isArray = require('util').isArray

var mime = require('mime')

var alternativeConfigPropsMap = {
  'route': 'routes',
  'proxy': 'proxies',
  'skip': 'skips',
  'skipExcept': 'skipExcepts',
  'serve': 'serves',
  'plugin': 'plugins',
  'transform': 'transforms'
}

module.exports = function(options){

  options = options || {}

  var config = {}

  var mergeDefaults = function(defaults, options){
    if (options === false) return false

    var getProp = function(prop){
      var alt = alternativeConfigPropsMap[prop]
      var value = options[prop] === undefined
        ? options[alt] : options[prop]
      if (value === undefined){
        return defaults[prop]
      }
      if (typeof defaults[prop] == 'boolean'){
        if (typeof value == 'string'){
          value = value.trim().toLowerCase()
          return value == 'true'
            ? true : (value == 'false' ? false : defaults[prop])
        }
      }
      return value
    }

    return Object.keys(defaults).reduce((prev, prop) => {
      prev[prop] = getProp(prop)
      return prev
    }, {})
  }

  var wrapArray = function(obj){
    if (!obj) return []
    return isArray(obj) ? obj : [obj]
  }

  var defaultConfig = require('./default-config')

  // take and structure options from plain first level
  if (options.serve !== false){
    ['serve', 'watch', 'clients'].forEach(function(section){
      if (options[section] !== false){
        options[section] = options[section] || {}
        Object.keys(defaultConfig[section]).forEach(function(prop){
          if (options[prop] !== undefined){
            options[section][prop] = options[section][prop] || options[prop]
          }
        })
      }
    })
  }

  config = mergeDefaults(defaultConfig, options)

  config.serve = mergeDefaults(defaultConfig.serve, options.serve)

  config.base = path.resolve(process.cwd(), config.base)

  if (config.serve){
    config.serve.debug = config.debug
    config.serve.base = config.base
    config.serve.port = config.port

    if (typeof config.serve.route == 'string'){
      config.serve.route = {'*': config.serve.route}
    }

    config.serve.route = wrapArray(config.serve.route)
    if (typeof config.serve.defaultRoute == 'string' && config.serve.defaultRoute){
      config.serve.route.push({'*': config.serve.defaultRoute})
    }
    config.serve.proxy = wrapArray(config.serve.proxy)
    if (config.serve.favicon === true){
      config.serve.favicon = defaultConfig.serve.favicon
    }

    if (config.serve.mime){
      if (config.serve.mime.define){
        mime.define(config.serve.mime.define)
      } else {
        mime.define(config.serve.mime)
      }
      if (config.serve.mime.default_type){
        mime.default_type = config.serve.mime.default_type
      }
    }

  }

  config.store = {}
  config.store.base = config.base
  config.store.watch = mergeDefaults(defaultConfig.watch, options.watch)
  if (config.store.watch){
    config.store.debug = config.debug
    config.store.watch.skip = wrapArray(config.store.watch.skip)
    config.store.watch.skipExcept = wrapArray(config.store.watch.skipExcept)
  }

  var transpile = config.serve.transpile

  if (transpile){
    transpile = Object.keys(transpile).map(function(p){
      return transpile[p]
    })
  }

  var getPlugin = function(name){

    var cwd = process.cwd()
    try {

      var paths = [
        // first, try to require module with watchalive- prefix
        // try to require nearest module
        'watchalive-' + name,
        path.join(__dirname, '../..', 'watchalive-' + name),
        // try to require apps module
        path.join(cwd, 'node_modules', 'watchalive-' + name),
        // then try to require module without watchalive- prefix
        name,
        path.join(__dirname, '../..', name),
        path.join(cwd, 'node_modules', name)
      ]
      return paths.reduce(function(prev, p){
        try {
          return prev || require(p)
        } catch(e) {
          return prev
        }
      }, false)
    } catch(e){
      return false
    }
  }

  config.plugin = config.plugin.map(function(plugin){

    if (!plugin) return

    var name, options

    var foundPlugin

    // if just string plugin: ['less', ..]
    if (typeof plugin == 'string'){
      name = plugin
      foundPlugin = getPlugin(name)

      // parse array options format it can be:
      // ['less', {paths: ['client']}]
      // OR
      // [/\.less$/, 'less', {paths: ['client']}]
      // OR custom
      // [/\.js$/, 'less', {paths: ['client']}]

    } else if (isArray(plugin)){
      var firstParam = plugin[0]
      var secondParam = plugin[1]
      var lastParam = plugin[plugin.length - 1]
      var testParam

      // check if first param is plugin name
      foundPlugin = typeof firstParam == 'string' && getPlugin(firstParam)

      if (foundPlugin){
        // set options if not the only param
        if (lastParam !== firstParam){
          options = lastParam
        }
      } else {
        // if not then first should be test param
        secondParam && (testParam = firstParam)
        // check if second param is plugin name
        foundPlugin = typeof secondParam == 'string' && getPlugin(secondParam)
        // set the option if not the sam param as second
        if (foundPlugin && lastParam !== secondParam){
          options = lastParam
        }
      }

      // if plugin not found by name, its a custom transformer
      if (!foundPlugin){
        // last param can be either object {transform: ...}
        if (typeof lastParam == 'object'){
          foundPlugin = lastParam
        }
        // or transform function, turn it to object
        if (typeof lastParam == 'function'){
          foundPlugin = {transform: lastParam}
        }

        if (foundPlugin){
          // if first param was test param
          testParam && (foundPlugin.test = testParam)
          // if first param was test param,
          // and second is not last, then it a name
          // for custom transformer
          if (testParam == firstParam && lastParam !== secondParam){
            foundPlugin.name = secondParam
          }
          if (!testParam && lastParam !== secondParam){
            foundPlugin.name = firstParam
          }
        }
      }
    }

    plugin = foundPlugin || plugin

    if (!plugin){
      console.warn('Plugin', name, 'attach failed.')
    } else {

      options = options || {}
      options.config = config
      // check if function constructor
      if (typeof plugin == 'function' && Object.keys(plugin.prototype).length > 0){
        plugin = new plugin(options)
      }
      if (plugin.name || name){
        console.info('Plugin', plugin.name || name, 'attached.')
      }

    }

    return plugin
  }).filter(function(p){return p})

  config.store.transpile = config.serve.transpile = transpile || []
  config.store.transpile = config.store.transpile.concat(config.plugin)

  config.clients = mergeDefaults(defaultConfig.clients, options.clients)

  if (config.clients){
    config.clients.debug = config.debug
    config.clients.port = config.port
  }

  if (config.clients.data){
    config.clients.reload = false
  }

  return config
}