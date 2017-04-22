'use strict'

const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const consts = require('./src/consts.js')
const rl = require('readline').createInterface({input: process.stdin})
const writer = require('./src/writer.js').init(consts.boundary)

let elements = {}

// App is ready
app.on('ready',() => {
    // Send electron.ready event
    writer.write(consts.mainTargetID, consts.eventNames.electronReady)

    // Read from stdin
    rl.on('line', function(line){
        // Check whether the boundary is there
        if (line.endsWith(consts.boundary)) {
            // Parse the JSON
            var json = JSON.parse(line.slice(0, -consts.boundary.length))

            // Switch on event name
            switch (json.name) {
                case consts.eventNames.windowCreate:
                elements[json.targetID] = new BrowserWindow(json.windowOptions)
                elements[json.targetID].on('ready-to-show', () => {
                  writer.write(json.targetID, consts.eventNames.windowReadyToShow)
                })
                elements[json.targetID].on('show', () => {
                  writer.write(json.targetID, consts.eventNames.windowShowDone)
                })
                writer.write(json.targetID, consts.eventNames.windowCreateDone)
                break;
                case consts.eventNames.windowShow:
                elements[json.targetID].show()
                break;
            }
        }
    })
})
