"use strict";

const net = require("net");
const url = require("url");
const {dialog} = require("electron").remote

// Client can read/write messages from a TCP server
class Client {
    // init initializes the Client
    init(addr) {

        var fs = require('fs')
        fs.appendFile("/tmp/astilectron.log", "Addr: "+addr, function(e){
            console.log("Error while writing to file:"+e);
        })

        this.socket = net.createConnection(addr);
        //this.connect(addr)

        this.socket.on('error', function(err){
            // Raising an exception in case of any error in socket
            const messageBoxOptions = {
                type: "error",
                title: "Error in Main process",
                message: err
            };
            dialog.showMessageBox(messageBoxOptions);
            process.exit(1)
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

    /*
     * for proper socket closing, unix socket remains open even after
     * quiting the application, this function ends the socket connection
     */
    close() {
        this.socket.end()
    }

    connect(addr) {
        tcp = "tcp://";
        if (addr.indexOf(tcp) == 0) {
            let u = url.parse(addr, false, false)
            this.socket = new net.Socket()
            this.socket.connect(u.port, u.hostname, function() {});    
        } else {
            this.socket = net.createConnection(addr);
        }        
    }
}

module.exports = new Client();
