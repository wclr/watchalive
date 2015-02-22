module.exports = function(clientsApp){

    console.log("Press ENTER to reload all clients".info)
    process.stdin.on('data', function(data){
        data = data.toString().toLowerCase()

        //if (/cache/.test(data)){
        //    console.log('File Cache:', Object.keys(fileCache))
        //    return
        //}

        if (!clientsApp) {
            return
        }

        if (/clients/.test(data)){
            // ouput only string properties
            console.log('Clients', clientsApp.clients.length + ':', clientsApp.clients.map(function(c){
                var obj = {}
                Object.keys(c).forEach(function(key){typeof c[key] == 'string' && (obj[key] = c[key])})
                return obj
            }))
            return
        }
        clientsApp.reloadClients()
    })

}