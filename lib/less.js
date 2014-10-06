var css = require("$css");
var lessEngine = require("less");

exports.instantiate = css.instantiate;

exports.translate = function(load) {
    var pathParts = (load.address+'').split('/');
    pathParts[pathParts.length - 1] = ''; // Remove filename

    if (typeof window !== 'undefined') {
        pathParts = (load.address+'').split('/');
        pathParts[pathParts.length - 1] = ''; // Remove filename
    }
    console.log('Parsing less', load.address)
    return new Promise(function(resolve, reject){
        //console.log('New less', load.address)
        new (lessEngine.Parser)({
            optimization: lessEngine.optimization,
            paths: [pathParts.join('/')],
            useFileCache: true,
            filename: load.address
        }).parse(load.source, function (e, root) {

                if(e){
                    reject(e);
                } else {

                    var source = load.source
                        //.replace(/\/\/.*/g, '')
                        //.replace(/\n/g ,'')
                        //.replace(/\/\*.*?\*\//g, '')

                    console.log('Parsed less', load.address)
                    resolve(root.toCSS() + '\n/* LESS_SOURCE=' + source +' */\n');
                }
            });
    });
};

exports.buildType = "css";
