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
    writer.write(consts.mainTargetID, consts.eventNames.appEventReady)

    // Read from stdin
    rl.on('line', function(line){
        // Check whether the boundary is there
        if (line.endsWith(consts.boundary)) {
            // Parse the JSON
            var json = JSON.parse(line.slice(0, -consts.boundary.length))

            // Switch on event name
            switch (json.name) {
                case consts.eventNames.windowCmdBlur:
                elements[json.targetID].blur()
                break;
                case consts.eventNames.windowCmdCenter:
                elements[json.targetID].center()
                break;
                case consts.eventNames.windowCmdClose:
                elements[json.targetID].close()
                break;
                case consts.eventNames.windowCmdCreate:
                windowCreate(json)
                break;
                case consts.eventNames.windowCmdDestroy:
                elements[json.targetID].destroy()
                break;
                case consts.eventNames.windowCmdFocus:
                elements[json.targetID].focus()
                break;
                case consts.eventNames.windowCmdHide:
                elements[json.targetID].hide()
                break;
                case consts.eventNames.windowCmdMaximize:
                elements[json.targetID].maximize()
                break;
                case consts.eventNames.windowCmdMinimize:
                elements[json.targetID].minimize()
                break;
                case consts.eventNames.windowCmdMove:
                elements[json.targetID].setPosition(json.windowOptions.x, json.windowOptions.y, true)
                break;
                case consts.eventNames.windowCmdResize:
                elements[json.targetID].setSize(json.windowOptions.width, json.windowOptions.height, true)
                break;
                case consts.eventNames.windowCmdRestore:
                elements[json.targetID].restore()
                break;
                case consts.eventNames.windowCmdShow:
                elements[json.targetID].show()
                break;
                case consts.eventNames.windowCmdUnmaximize:
                elements[json.targetID].unmaximize()
                break;
            }
        }
    })
})

// windowCreate creates a new window
function windowCreate(json) {
    elements[json.targetID] = new BrowserWindow(json.windowOptions)
    elements[json.targetID].loadURL(json.url);
    elements[json.targetID].on('blur', () => { writer.write(json.targetID, consts.eventNames.windowEventBlur) })
    elements[json.targetID].on('closed', () => {
        writer.write(json.targetID, consts.eventNames.windowEventClosed)
        delete elements[json.targetID]
    })
    elements[json.targetID].on('focus', () => { writer.write(json.targetID, consts.eventNames.windowEventFocus) })
    elements[json.targetID].on('hide', () => { writer.write(json.targetID, consts.eventNames.windowEventHide) })
    elements[json.targetID].on('maximize', () => { writer.write(json.targetID, consts.eventNames.windowEventMaximize) })
    elements[json.targetID].on('minimize', () => { writer.write(json.targetID, consts.eventNames.windowEventMinimize) })
    elements[json.targetID].on('move', () => { writer.write(json.targetID, consts.eventNames.windowEventMove) })
    elements[json.targetID].on('ready-to-show', () => { writer.write(json.targetID, consts.eventNames.windowReadyToShow) })
    elements[json.targetID].on('resize', () => { writer.write(json.targetID, consts.eventNames.windowEventResize) })
    elements[json.targetID].on('restore', () => { writer.write(json.targetID, consts.eventNames.windowEventRestore) })
    elements[json.targetID].on('show', () => { writer.write(json.targetID, consts.eventNames.windowEventShow) })
    elements[json.targetID].on('unmaximize', () => { writer.write(json.targetID, consts.eventNames.windowEventUnmaximize) })
    elements[json.targetID].on('unresponsive', () => { writer.write(json.targetID, consts.eventNames.windowEventUnresponsive) })
    writer.write(json.targetID, consts.eventNames.windowDoneCreate)
}
