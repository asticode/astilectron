'use strict'

// Client can read/write messages to/from stdout/stdin
class Client {
    // input returns the client input
    input() {
        return process.stdin
    }

    // write writes an event to stdout
    write(targetID, eventName, payload) {
        var data = {name: eventName, targetID: targetID}
        if (typeof payload !== "undefined") Object.assign(data, payload)
        process.stdout.write(JSON.stringify(data) + "\n")
    }
}

module.exports = new Client()
