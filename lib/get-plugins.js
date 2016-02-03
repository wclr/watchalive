'use strict'

var path = require('path')
var isArray = require('util').isArray


module.exports = function(plugins, config){

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
        if (prev) return prev
        try {
          let found = {plugin: require(p), name: path.basename(p)}

          // get package version
          if (found){
            try {
              let pkg = require(p + '/package.json')
              found.name = found.name || pkg.name
              found.version = pkg.version
            } catch (e) {
              return found
            }
          }
          return found
        } catch(e) {
          return prev
        }
      }, false)
    } catch(e){
      return false
    }
  }

  plugins = plugins.filter(function(p){return p})

  return plugins.map(function(plugin) {
    var found

    // if just string plugin: ['less', ..]
    if (typeof plugin == 'string'){
      found = getPlugin(plugin)
      found && (found.name = found.name || plugin)

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
      found = typeof firstParam == 'string' &&
        getPlugin(firstParam)

      if (found){
        if (typeof firstParam == 'string' && !found.name){
          found.name = firstParam
        }
        // set options if not the only param
        if (lastParam !== firstParam){
          found.options = lastParam
        }
      } else {
        // if not then first should be test param
        secondParam && (testParam = firstParam)
        // check if second param is plugin name
        found = typeof secondParam == 'string' && getPlugin(secondParam)
        if (found && typeof secondParam == 'string' && !found.name){
          found.name = secondParam
        }
        found && (found.test = testParam)

        // set the option if not the sam param as second
        if (found && lastParam !== secondParam){
          found.options = lastParam
        }
      }

      // if plugin not found by name, its a custom transformer
      if (!found){
        // last param can be either object {transform: ...}
        if (typeof lastParam == 'object'){
          found = {plugin: lastParam}
        }
        // or transform function, turn it to object
        if (typeof lastParam == 'function'){
          found = {plugin: {transform: lastParam}}
        }

        if (found){
          // if first param was test param
          testParam && (found.test = testParam)
          // if first param was test param,
          // and second is not last, then it a name
          // for custom transformer
          if (testParam == firstParam && lastParam !== secondParam){
            found.name = secondParam
          }
          if (!testParam && lastParam !== secondParam){
            found.name = firstParam
          }

          found.name = found.name || found.plugin.name
          found.options = found.name || found.plugin.options
        }
      }
    }

    found = found || plugin

    if (!found){
      console.warn('Plugin', plugin, 'attach failed.')
    } else {
      // attache config to options
      //console.log('found', found)
      if (found.plugin.config === true){
        found.options = found.options || {}
        found.options.config = config
      }

      found.test = found.test || found.plugin.test || found.plugin.match || found.plugin.pattern

      // check if function constructor
      if (typeof found.plugin == 'function' && Object.keys(found.plugin.prototype).length > 0){
        found.plugin = new found.plugin(found.options)

        // repeat for new instance
        found.test = found.test || found.plugin.test || found.plugin.match || found.plugin.pattern
        if (found.plugin.config === true){
          found.options = found.options || {}
          found.options.config = config
        }
      }

      //if (found.name){
      var nameStr = found.name ? ' ' + found.name : ''
      var versionStr = found.version
        ? ' version (' + found.version + ')'
        : ''
      var matchStr = found.test
        && typeof found.test !== 'function'
        ? ', matches: ' + found.test
        : ''
      console.info('Plugin' + nameStr + versionStr + ' attached' + matchStr)
      //}
    }
    return found
  }).filter(function(p){return p})
}