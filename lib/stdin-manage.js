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

            console.log('Clients connected', clientsApp.clients.length + ':')
            clientsApp.clients.forEach(function(c){
                console.log(c.fullName)
            })

            return
        }
        clientsApp.reloadClients()
    })

}