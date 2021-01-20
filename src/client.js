"use strict";

const net = require("net")
const url = require("url")
const {dialog} = require("electron")

// Client can read/write messages from a TCP server
class Client {
    // init initializes the Client
    init(addr) {
        
        this.socket = net.createConnection(addr);
      
        this.socket.on('error', function(err){
            // Raising an exception in case of any error in socket
            const messageBoxOptions = {
                type: "error",
                title: "Error in Main process",
                message: err
            };
            dialog.showMessageBox(messageBoxOptions);
            process.exit(1);
        });

        this.socket.on('close', function() {
            process.exit();
        })
        return this
    }

    // write writes an event to the server
    write(targetID, eventName, payload) {
      if(this.socket.destroyed) return;
      let data = { name: eventName, targetID: targetID };
      if (typeof payload !== "undefined") Object.assign(data, payload);
      this.socket.write(JSON.stringify(data) + "\n");
    }

    /*
     * for proper socket closing, unix socket remains open even after
     * quiting the application, this function ends the socket connection
     */
    close() {
        this.socket.end();
    }
}

module.exports = new Client();
