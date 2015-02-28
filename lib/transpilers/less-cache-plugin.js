var win32 = process.platform === 'win32',
    PromiseConstructor = typeof Promise === 'undefined' ? require('bluebird') : Promise;

module.exports = function(cache){

    return function(less) {
        var FileManager = less.FileManager,
            npmProtocolPrefixRegex = /^npm:\/\//i;

        function CacheFileManager() {
        };

        CacheFileManager.prototype = new FileManager();

        //NpmFileManager.prototype.supports = function(filename, currentDirectory, options, environment) {
        //    return filename.match(npmProtocolPrefixRegex) || currentDirectory.match(npmProtocolPrefixRegex);
        //};
        //NpmFileManager.prototype.supportsSync = NpmFileManager.prototype.supports;


        CacheFileManager.prototype.loadFile = function(filename, currentDirectory, options, environment) {
            console.log('CacheFileManager loadFile', filename, currentDirectory)
            try {

            }
            catch(e) {
                return new PromiseConstructor(
                    function(fullfill, reject) {
                        reject(e);
                    }
                );
            }
            return FileManager.prototype.loadFile.call(this, filename, "", options, environment);
        };

        NpmFileManager.prototype.loadFileSync = function(filename, currentDirectory, options, environment) {
            try {
                filename = this.resolve(filename, currentDirectory);
            }
            catch(e) {
                return { error: e };
            }
            return FileManager.prototype.loadFileSync.call(this, filename, "", options, environment);
        };

        return NpmFileManager;
    }
};