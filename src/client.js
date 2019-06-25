'use strict'

const net = require('net');
const url = require('url');

// Client can read/write messages from a TCP server
class Client {
    // init initializes the Client
    init() {

        this.getconnection()

        this.socket.on('error', function(err){
            // Writing to a file in case of error related to socket
            var fs = require('fs');
            fs.appendFile("/tmp/astilectron.log", "Socket Error: "+err, function(e){
                console.log("Error while writing to file:"+e);
            })
            process.exit()
        })

        this.socket.on('close', function() {
            process.exit()
        })
        return this
    }

    // write writes an event to the server
    write(targetID, eventName, payload) {
        let data = {name: eventName, targetID: targetID}
        if (typeof payload !== "undefined") Object.assign(data, payload)
        this.socket.write(JSON.stringify(data) + "\n")
    }

    // for proper socket closing
    close() {
        this.socket.end()
    }

    // getconnection establishes connection based on underlying OS
    getconnection() {
        if ( os.platform() != "win32" ) {
            this.socket = net.createConnection(process.argv[1]);
        } else {
            let u = url.parse("tcp://" + process.argv[1], false, false)
            this.socket = new net.Socket()
            this.socket.connect(u.port, u.hostname, function() {});
        }
    }
}

module.exports = new Client()
