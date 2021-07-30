"use strict";

const net = require("net");
const url = require("url");

function cleanStringify(object) {
  if (object && typeof object === 'object') {
    object = copyWithoutCircularReferences([object], object);
  }
  return JSON.stringify(object);

  function copyWithoutCircularReferences(references, object) {
    var cleanObject = {};
    Object.keys(object).forEach(function(key) {
      var value = object[key];
      if (value && typeof value === 'object') {
        if (references.indexOf(value) < 0) {
          references.push(value);
          cleanObject[key] = copyWithoutCircularReferences(references, value);
          references.pop();
        } else {
          cleanObject[key] = '###_Circular_###';
        }
      } else if (typeof value !== 'function') {
        cleanObject[key] = value;
      }
    });
    return cleanObject;
  }
}

// Client can read/write messages from a TCP server
class Client {
  // init initializes the Client
  init(addr) {
    let u = url.parse("tcp://" + addr, false, false);
    this.socket = new net.Socket();
    this.socket.connect(u.port, u.hostname, function() {});
    this.socket.on("close", function() {
      process.exit();
    });
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
    let stringifyData = '';
    try {
      stringifyData = JSON.stringify(data);
    } catch (_) {
      stringifyData = cleanStringify(data);
    }
    this.socket.write(stringifyData + "\n");
  }
}

module.exports = new Client();
