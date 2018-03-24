'use strict'

const electron = require('electron')
const {app, BrowserWindow, ipcMain, Menu, MenuItem, Tray, dialog} = electron
const consts = require('./src/consts.js')
const client = require('./src/client.js').init()
const rl = require('readline').createInterface({input: client.socket})

let elements = {}
let menus = {}
let quittingApp = false

// Command line switches
let idx = 3;
for (let i = idx; i < process.argv.length; i++) {
    let s = process.argv[i].replace(/^[\-]+/g,"");
    let v;
    if (typeof process.argv[i+1] !== "undefined" && !process.argv[i+1].startsWith("-")) {
        v = process.argv[i+1];
        i++;
    }
    app.commandLine.appendSwitch(s, v);
}

// App is quitting
app.on('before-quit', () => quittingApp = true);

// App is ready
app.on('ready',() => {
    // Init
    const screen = electron.screen
    Menu.setApplicationMenu(null)

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
    ipcMain.on(consts.eventNames.ipcEventMessage, (event, arg) => {
        let payload = {message: arg.message};
        if (typeof arg.callbackId !== "undefined") payload.callbackId = arg.callbackId;
        client.write(arg.targetID, consts.eventNames.windowEventMessage, payload)
    });
    ipcMain.on(consts.eventNames.ipcEventMessageCallback, (event, arg) => {
        let payload = {message: arg.message};
        if (typeof arg.callbackId !== "undefined") payload.callbackId = arg.callbackId;
        client.write(arg.targetID, consts.eventNames.windowEventMessageCallback, payload)
    });

    // Read from client
    rl.on('line', function(line){
        // Parse the JSON
        let json = JSON.parse(line)

        // Switch on event name
        let window;
        switch (json.name) {
            // App
            case consts.eventNames.appCmdQuit:
            app.quit();
            break;

            // Menu
            case consts.eventNames.menuCmdCreate:
            menuCreate(json.menu)
            menus[json.menu.rootId] = json.targetID
            setMenu(json.menu.rootId)
            client.write(json.targetID, consts.eventNames.menuEventCreated)
            break;
            case consts.eventNames.menuCmdDestroy:
            elements[json.targetID] = null
            if (menus[json.menu.rootId] === json.targetID) {
                menus[json.menu.rootId] = null
                setMenu(json.menu.rootId)
            }
            client.write(json.targetID, consts.eventNames.menuEventDestroyed)
            break;

            // Menu item
            case consts.eventNames.menuItemCmdSetChecked:
            elements[json.targetID].checked = json.menuItemOptions.checked
            client.write(json.targetID, consts.eventNames.menuItemEventCheckedSet)
            break;
            case consts.eventNames.menuItemCmdSetEnabled:
            elements[json.targetID].enabled = json.menuItemOptions.enabled
            client.write(json.targetID, consts.eventNames.menuItemEventEnabledSet)
            break;
            case consts.eventNames.menuItemCmdSetLabel:
            elements[json.targetID].label = json.menuItemOptions.label
            client.write(json.targetID, consts.eventNames.menuItemEventLabelSet)
            break;
            case consts.eventNames.menuItemCmdSetVisible:
            elements[json.targetID].visible = json.menuItemOptions.visible
            client.write(json.targetID, consts.eventNames.menuItemEventVisibleSet)
            break;

            // Session
            case consts.eventNames.sessionCmdClearCache:
            elements[json.targetID].clearCache(function() {
                client.write(json.targetID, consts.eventNames.sessionEventClearedCache)
            })
            break;

            // Sub menu
            case consts.eventNames.subMenuCmdAppend:
            elements[json.targetID].append(menuItemCreate(json.menuItem))
            setMenu(json.menuItem.rootId)
            client.write(json.targetID, consts.eventNames.subMenuEventAppended)
            break;
            case consts.eventNames.subMenuCmdClosePopup:
            window = null
            if (typeof json.windowId !== "undefined") {
                window = elements[json.windowId]
            }
            elements[json.targetID].closePopup(window)
            client.write(json.targetID, consts.eventNames.subMenuEventClosedPopup)
            break;
            case consts.eventNames.subMenuCmdInsert:
            elements[json.targetID].insert(json.menuItemPosition, menuItemCreate(json.menuItem))
            setMenu(json.menuItem.rootId)
            client.write(json.targetID, consts.eventNames.subMenuEventInserted)
            break;
            case consts.eventNames.subMenuCmdPopup:
            window = null
            if (typeof json.windowId !== "undefined") {
                window = elements[json.windowId]
            }
            json.menuPopupOptions.async = true
            elements[json.targetID].popup(window, json.menuPopupOptions)
            client.write(json.targetID, consts.eventNames.subMenuEventPoppedUp)
            break;

            // Tray
            case consts.eventNames.trayCmdCreate:
            trayCreate(json)
            break;
            case consts.eventNames.trayCmdDestroy:
            elements[json.targetID].destroy()
            elements[json.targetID] = null
            client.write(json.targetID, consts.eventNames.trayEventDestroyed)
            break;

            // Window
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
            elements[json.targetID] = null
            break;
            case consts.eventNames.windowCmdFocus:
            elements[json.targetID].focus()
            break;
            case consts.eventNames.windowCmdHide:
            elements[json.targetID].hide()
            break;
            case consts.eventNames.windowCmdLog:
            elements[json.targetID].webContents.send(consts.eventNames.ipcCmdLog, json.message)
            break;
            case consts.eventNames.windowCmdMaximize:
            elements[json.targetID].maximize()
            break;
            case consts.eventNames.windowCmdMessage:
            case consts.eventNames.windowCmdMessageCallback:
            let m = {message: json.message}
            if (typeof json.callbackId !== "undefined") m.callbackId = json.callbackId
            elements[json.targetID].webContents.send(json.name === consts.eventNames.windowCmdMessageCallback ? consts.eventNames.ipcCmdMessageCallback : consts.eventNames.ipcCmdMessage, m)
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

    // Send electron.ready event
    client.write(consts.mainTargetID, consts.eventNames.appEventReady, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})
})

// menuCreate creates a new menu
function menuCreate(menu) {
    if (typeof menu !== "undefined") {
        elements[menu.id] = new Menu()
        for(let i = 0; i < menu.items.length; i++) {
            elements[menu.id].append(menuItemCreate(menu.items[i]))
        }
        return elements[menu.id]
    }
    return null
}

// menuItemCreate creates a menu item
function menuItemCreate(menuItem) {
    const itemId = menuItem.id
    menuItem.options.click = function(menuItem) {
        client.write(itemId, consts.eventNames.menuItemEventClicked, {menuItemOptions: menuItemToJSON(menuItem)})
    }
    if (typeof menuItem.submenu !== "undefined") {
        menuItem.options.type = 'submenu'
        menuItem.options.submenu = menuCreate(menuItem.submenu)
    }
    elements[itemId] = new MenuItem(menuItem.options)
    return elements[itemId]
}

// menuItemToJSON returns the proper fields not to raise an exception
function menuItemToJSON(menuItem) {
    return {
        checked: menuItem.checked,
        enabled: menuItem.enabled,
        label: menuItem.label,
        visible: menuItem.visible,
    }
}

// setMenu sets a menu
function setMenu(rootId) {
    let menu = null
    if (typeof menus[rootId] !== "undefined" && typeof elements[menus[rootId]] !== "undefined") {
        menu = elements[menus[rootId]]
    }
    if (rootId === consts.mainTargetID) {
        Menu.setApplicationMenu(menu)
    } else if (elements[rootId].constructor === Tray) {
        elements[rootId].setContextMenu(menu);
    } else {
        elements[rootId].setMenu(menu);
    }
}

// trayCreate creates a tray
function trayCreate(json) {
    elements[json.targetID] = new Tray(json.trayOptions.image);
    if (typeof json.trayOptions.tooltip !== "undefined") {
        elements[json.targetID].setToolTip(json.trayOptions.tooltip);
    }
    elements[json.targetID].on('click', () => { client.write(json.targetID, consts.eventNames.trayEventClicked) })
    elements[json.targetID].on('double-click', () => { client.write(json.targetID, consts.eventNames.trayEventDoubleClicked) })
    elements[json.targetID].on('right-click', () => { client.write(json.targetID, consts.eventNames.trayEventRightClicked) })
    client.write(json.targetID, consts.eventNames.trayEventCreated)
}

// windowCreate creates a new window
function windowCreate(json) {
    elements[json.targetID] = new BrowserWindow(json.windowOptions)
    elements[json.targetID].setMenu(null)
    elements[json.targetID].loadURL(json.url);
    elements[json.targetID].on('blur', () => { client.write(json.targetID, consts.eventNames.windowEventBlur) })
    elements[json.targetID].on('close', (e) => {
        if (typeof json.windowOptions.messageBoxOnClose !== "undefined") {
            let buttonId = dialog.showMessageBox(null, json.windowOptions.messageBoxOnClose)
            if (typeof json.windowOptions.messageBoxOnClose.confirmId !== "undefined" && json.windowOptions.messageBoxOnClose.confirmId !== buttonId) {
                e.preventDefault()
                return
            }
        }
        if (json.windowOptions.minimizeOnClose && !quittingApp) {
            e.preventDefault();
            elements[json.targetID].minimize();
        }
    })
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
            `const {ipcRenderer} = require('electron')
            const {dialog} = require('electron').remote
            ipcRenderer.on('`+ consts.eventNames.ipcCmdLog+`', function(event, message) {
                console.log(message)
            })
            var onMessageOnce = false;
            var astilectron = {
                onMessage: function(callback) {
                    if (onMessageOnce) {
                        return
                    }
                    ipcRenderer.on('`+ consts.eventNames.ipcCmdMessage +`', function(event, message) {
                        let v = callback(message.message)
                        if (typeof message.callbackId !== "undefined") {
                            let e = {callbackId: message.callbackId, targetID: '`+ json.targetID +`'}
                            if (typeof v !== "undefined") e.message = v
                            ipcRenderer.send('`+ consts.eventNames.ipcEventMessageCallback +`', e)
                        }
                    })
                    onMessageOnce = true
                },
                callbackIdCounter: 1,
                sendMessage: function(message, callback) {
                    let e = {message: message, targetID: '`+ json.targetID +`'}
                    if (typeof callback !== "undefined") {
                        e.callbackId = String(astilectron.callbackIdCounter++)
                        ipcRenderer.on('`+ consts.eventNames.ipcCmdMessageCallback +`', function(event, message) {
                            if (message.callbackId === e.callbackId) {
                                callback(message.message)
                            }
                        });
                    }
                    ipcRenderer.send('`+ consts.eventNames.ipcEventMessage +`', e)
                },
                showErrorBox: function(title, content) {
                    dialog.showErrorBox(title, content)
                },
                showMessageBox: function(options, callback) {
                    dialog.showMessageBox(null, options, callback)
                },
                showOpenDialog: function(options, callback) {
                    dialog.showOpenDialog(null, options, callback)
                },
                showSaveDialog: function(options, callback) {
                    dialog.showSaveDialog(null, options, callback)
                }
            }
            document.dispatchEvent(new Event('astilectron-ready'))`
        )
        sessionCreate(elements[json.targetID].webContents, json.sessionId)
        client.write(json.targetID, consts.eventNames.windowEventDidFinishLoad)
    })
    elements[json.targetID].webContents.on('did-get-redirect-request', (event, oldUrl, newUrl) => {
        client.write(json.targetID, consts.eventNames.windowEventDidGetRedirectRequest, {
            url: newUrl
        })
    })
    elements[json.targetID].webContents.on('will-navigate', (event, url) => {
        client.write(json.targetID, consts.eventNames.windowEventWillNavigate, {
            url
        })
    })
}

function sessionCreate(webContents, sessionId) {
    elements[sessionId] = webContents.session
    elements[sessionId].on('will-download', () => { client.write(sessionId, consts.eventNames.sessionEventWillDownload) })
}
