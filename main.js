'use strict'

const electron = require('electron')
const {app, BrowserWindow, ipcMain} = electron
const consts = require('./src/consts.js')
const client = require('./src/client.js').init()
const rl = require('readline').createInterface({input: client.socket})

let elements = {}

// App is ready
app.on('ready',() => {
    // Init
    const screen = electron.screen
    
    // Send electron.ready event
    client.write(consts.mainTargetID, consts.eventNames.appEventReady, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})

    // Listen to screen events
    screen.on('display-added', function() {
        client.write(consts.mainTargetID, consts.eventNames.displayEventAdded, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})
    })
    screen.on('display-metrics-changed', function() {
        client.write(consts.mainTargetID, consts.eventNames.displayEventMetricsChanged, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})
    })
    screen.on('display-removed', function() {
        client.write(consts.mainTargetID, consts.eventNames.displayEventRemoved, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})
    })

    // Listen on main ipcMain
    ipcMain.on(consts.eventNames.ipcWindowMessage, (event, arg) => {
        client.write(arg.targetID, consts.eventNames.windowEventMessage, {message: arg.message})
    })

    // Read from client
    rl.on('line', function(line){
        // Parse the JSON
        var json = JSON.parse(line)

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
            case consts.eventNames.windowCmdMessage:
            elements[json.targetID].webContents.send(consts.eventNames.ipcWindowMessage, json.message)
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
            case consts.eventNames.windowCmdWebContentsCloseDevTools:
            elements[json.targetID].webContents.closeDevTools()
            break;
            case consts.eventNames.windowCmdWebContentsOpenDevTools:
            elements[json.targetID].webContents.openDevTools()
            break;
            case consts.eventNames.windowCmdUnmaximize:
            elements[json.targetID].unmaximize()
            break;
        }
    })
})

// windowCreate creates a new window
function windowCreate(json) {
    elements[json.targetID] = new BrowserWindow(json.windowOptions)
    elements[json.targetID].loadURL(json.url);
    elements[json.targetID].on('blur', () => { client.write(json.targetID, consts.eventNames.windowEventBlur) })
    elements[json.targetID].on('closed', () => {
        client.write(json.targetID, consts.eventNames.windowEventClosed)
        delete elements[json.targetID]
    })
    elements[json.targetID].on('focus', () => { client.write(json.targetID, consts.eventNames.windowEventFocus) })
    elements[json.targetID].on('hide', () => { client.write(json.targetID, consts.eventNames.windowEventHide) })
    elements[json.targetID].on('maximize', () => { client.write(json.targetID, consts.eventNames.windowEventMaximize) })
    elements[json.targetID].on('minimize', () => { client.write(json.targetID, consts.eventNames.windowEventMinimize) })
    elements[json.targetID].on('move', () => { client.write(json.targetID, consts.eventNames.windowEventMove) })
    elements[json.targetID].on('ready-to-show', () => { client.write(json.targetID, consts.eventNames.windowEventReadyToShow) })
    elements[json.targetID].on('resize', () => { client.write(json.targetID, consts.eventNames.windowEventResize) })
    elements[json.targetID].on('restore', () => { client.write(json.targetID, consts.eventNames.windowEventRestore) })
    elements[json.targetID].on('show', () => { client.write(json.targetID, consts.eventNames.windowEventShow) })
    elements[json.targetID].on('unmaximize', () => { client.write(json.targetID, consts.eventNames.windowEventUnmaximize) })
    elements[json.targetID].on('unresponsive', () => { client.write(json.targetID, consts.eventNames.windowEventUnresponsive) })
    elements[json.targetID].webContents.on('did-finish-load', () => {
        elements[json.targetID].webContents.executeJavaScript(
            `const ipcRenderer = require('electron').ipcRenderer
            var astilectron = {
                listen: function(callback) {
                    ipcRenderer.on('`+ consts.eventNames.ipcWindowMessage +`', function(event, message) {
                        callback(message)
                    })
                },
                send: function(message) {
                    ipcRenderer.send('`+ consts.eventNames.ipcWindowMessage +`', {message: message, targetID: '`+ json.targetID +`'})
                }
            }
            document.dispatchEvent(new Event('astilectron-ready'))`
        )
        client.write(json.targetID, consts.eventNames.windowEventDidFinishLoad)
    })
}
