'use strict'

// Writer writes messages to stdout
class Writer {
    // init initializes the Writer
    init(boundary) {
        this.boundary = boundary
        return this
    }

    // write writes an event to the stdout
    write(targetID, eventName) {
        process.stdout.write(JSON.stringify({name: eventName, targetID: targetID}) + this.boundary + "\n")
    }
}

module.exports = new Writer()
