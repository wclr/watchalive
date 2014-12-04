// old code for importing client less
if (change.file.match(/\.less$/)){

    if (typeof less == 'object'){

        var parseLessFile = function(url, data, callback ){
            var pathParts = (url + '').split('/');
            pathParts[pathParts.length - 1] = ''; // Remove filename

            new (less.Parser)({
                optimization: less.optimization,
                paths: [pathParts.join('/')],
                useFileCache: true,
                filename: url
            }).parse(data, function (e, root) {
                    if(e){
                        console.log('Error parsing less', e, data);
                    } else {
                        //var source = data
                        //.replace(/\/\/.*/g, '')
                        //.replace(/\n/g ,'')
                        //.replace(/\/\*.*?\*\//g, '')

                        //console.log('parseLessFile putting less back', source)
                        callback(url, root.toCSS() + '\n/* LESS_SOURCE=' + data +' */\n'
                            //'/* LESS SOURCE */\n' + commentSource(data) +'\n/* END OF LESS SOURCE */\n' + root.toCSS()
                        )
                    }
                });
        }
        var cachedUrl = '/' + change.file
        if (less.fileCache && less.fileCache[cachedUrl]){
            if (options.debug){
                console.log('Replacing less cache of ' + cachedUrl)
            }

            less.fileCache[cachedUrl] = change.data

            for (var i = 0; i < document.styleSheets.length; i++){
                var ss = document.styleSheets[i]
                cachedUrl = cachedUrl.replace(/.\less$/, '')
                // look for styles that import this one
                var match = new RegExp('@import\\s+(\'|")' + cachedUrl + '(\\.less)?(\'|")' )
                if (ss.ownerNode.innerHTML.match(match)){
                    //console.log('look for ', match)
                    var node = ss.ownerNode,
                        sourceMatch = node.innerHTML.match(/sourceURL=(.*?) /)

                    if (sourceMatch){
                        var sourceUrl = sourceMatch[1]

                        var lessData = node.innerHTML.match(/LESS_SOURCE=([\S\s]*?) \*\/\n/)
                        //console.log('Replacing style with import', sourceUrl, node.innerHTML.indexOf('LESS_SOURCE='), lessData)
                        if (lessData) {
                            if (options.debug){
                                console.log('Replacing style with import', sourceUrl)
                            }

                            ;(function(node, sourceUrl, lessData){

                                parseLessFile(sourceUrl, lessData, function(url, parsedData){
                                    node.innerHTML = parsedData + '/*# sourceURL='+ sourceUrl +' */'
                                })

                            })(node, sourceUrl, lessData[1])

                        }
                    }
                }
            }

        } else {
            parseLessFile(url, change.data, replaceCssStyle)
        }
    }
}