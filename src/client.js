"use strict";

const net = require("net");
const url = require("url");

// Client can read/write messages from a TCP server
class Client {
  connectionListener = null;

  // init initializes the Client
  init(addr) {
    let u = url.parse("tcp://" + addr, false, false);
    this.socket = new net.Socket();
    this.socket.connect(u.port, u.hostname, function() {
      if (this.connectionListener) {
        this.connectionListener()
      }
    }.bind(this));
    this.socket.on("close", function() {
      // Socket closed, try to reconnect
      setTimeout(() => {
        this.init(addr);
      }, 200)
    }.bind(this));
    this.socket.on("error", function(err) {
      // Prevent Unhandled Exception resulting from TCP Error
      console.error(err);
    });
    return this;
  }

  // write writes an event to the server
  write(targetID, eventName, payload) {
    if(this.socket.destroyed) return;
    let data = { name: eventName, targetID: targetID };
    if (typeof payload !== "undefined") Object.assign(data, payload);
    this.socket.write(JSON.stringify(data) + "\n");
  }
}

module.exports = new Client();
