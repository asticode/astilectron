'use strict'

// Writer writes messages to stdout
class Writer {
    // init initializes the Writer
    init(boundary) {
        this.boundary = boundary
        return this
    }

    // write writes an event to the stdout
    write(targetID, eventName, message) {
        var data = {name: eventName, targetID: targetID}
        if (typeof message != "undefined") data.message = message
        process.stdout.write(JSON.stringify(data) + this.boundary + "\n")
    }
}

module.exports = new Writer()
