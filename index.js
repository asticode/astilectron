// @ts-check
'use strict'

const electron = require('electron')
const {app, BrowserWindow, ipcMain, Menu, MenuItem, Tray, dialog, Notification} = electron
const consts = require('./src/consts.js')
const client = require('./src/client.js')
const readline = require('readline')

let rl;
let callbacks = {};
let counters = {};
let elements = {};
let menus = {};
let quittingApp = false;

// Single instance
let lastWindow = null;

// App is quitting
const beforeQuit = () => {
    quittingApp = true;
    client.write(consts.targetIds.app,consts.eventNames.appCmdQuit);
};

// App is ready
function onReady () {
    // Init
    const screen = electron.screen
    Menu.setApplicationMenu(null)

    // Listen to screen events
    screen.on('display-added', function() {
        client.write(consts.targetIds.app, consts.eventNames.displayEventAdded, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})
    })
    screen.on('display-metrics-changed', function() {
        client.write(consts.targetIds.app, consts.eventNames.displayEventMetricsChanged, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})
    })
    screen.on('display-removed', function() {
        client.write(consts.targetIds.app, consts.eventNames.displayEventRemoved, {displays: {all: screen.getAllDisplays(), primary: screen.getPrimaryDisplay()}})
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

            // Dock
            case consts.eventNames.dockCmdBounce:
            let id = 0;
            if (typeof app.dock !== "undefined") {
                id = app.dock.bounce(json.bounceType);
            }
            client.write(consts.targetIds.dock, consts.eventNames.dockEventBouncing, {id: id});
            break;
            case consts.eventNames.dockCmdBounceDownloads:
            if (typeof app.dock !== "undefined") {
                app.dock.downloadFinished(json.filePath);
            }
            client.write(consts.targetIds.dock, consts.eventNames.dockEventDownloadsBouncing);
            break;
            case consts.eventNames.dockCmdCancelBounce:
            if (typeof app.dock !== "undefined") {
                app.dock.cancelBounce(json.id);
            }
            client.write(consts.targetIds.dock, consts.eventNames.dockEventBouncingCancelled);
            break;
            case consts.eventNames.dockCmdHide:
            if (typeof app.dock !== "undefined") {
                app.dock.hide();
            }
            client.write(consts.targetIds.dock, consts.eventNames.dockEventHidden);
            break;
            case consts.eventNames.dockCmdSetBadge:
            if (typeof app.dock !== "undefined") {
                app.dock.setBadge(json.badge);
            }
            client.write(consts.targetIds.dock, consts.eventNames.dockEventBadgeSet);
            break;
            case consts.eventNames.dockCmdSetIcon:
            if (typeof app.dock !== "undefined") {
                app.dock.setIcon(json.image);
            }
            client.write(consts.targetIds.dock, consts.eventNames.dockEventIconSet);
            break;
            case consts.eventNames.dockCmdShow:
            if (typeof app.dock !== "undefined") {
                app.dock.show();
            }
            client.write(consts.targetIds.dock, consts.eventNames.dockEventShown);
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

            // Notification
            case consts.eventNames.notificationCmdCreate:
            notificationCreate(json);
            break;
            case consts.eventNames.notificationCmdShow:
            if (Notification.isSupported()) {
                elements[json.targetID].show();
            }
            break;

            // Session
            case consts.eventNames.sessionCmdClearCache:
            elements[json.targetID].clearCache().then(() => {
                client.write(json.targetID, consts.eventNames.sessionEventClearedCache)
            })
            break;
            case consts.eventNames.sessionCmdFlushStorage:
            elements[json.targetID].flushStorageData();
            client.write(json.targetID, consts.eventNames.sessionEventFlushedStorage)
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
            case consts.eventNames.trayCmdSetImage:
            elements[json.targetID].setImage(json.image);
            client.write(json.targetID, consts.eventNames.trayEventImageSet)
            break;

            // Web contents
            case consts.eventNames.webContentsEventLoginCallback:
            executeCallback(consts.callbackNames.webContentsLogin, json, [json.username, json.password]);
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
            case consts.eventNames.windowCmdSetBounds:
            elements[json.targetID].setBounds(json.bounds, true);
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
            case consts.eventNames.windowCmdWebContentsExecuteJavascript:
            elements[json.targetID].webContents.executeJavaScript(json.code).then(() => client.write(json.targetID, consts.eventNames.windowEventWebContentsExecutedJavaScript));
            break;
        }
    });

    // Send electron.ready event
    client.write(consts.targetIds.app, consts.eventNames.appEventReady, {
        displays: {
            all: screen.getAllDisplays(),
            primary: screen.getPrimaryDisplay()
        },
        supported: {
            notification: Notification.isSupported()
        }
    })
};

// start begins listening to go-astilectron.
function start(address = process.argv[2]) {
    client.init(address);
    rl = readline.createInterface({ input: client.socket });

    app.on("before-quit", beforeQuit);
    if (app.isReady()) {
        onReady();
    } else {
        app.on("ready", onReady);
    }
    app.on("window-all-closed", app.quit);
}

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
    if (rootId === consts.targetIds.app) {
        Menu.setApplicationMenu(menu)
    } else if (rootId === consts.targetIds.dock && typeof app.dock !== "undefined") {
        app.dock.setMenu(menu)
    } else if (elements[rootId].constructor === Tray) {
        elements[rootId].setContextMenu(menu);
    } else {
        elements[rootId].setMenu(menu);
    }
}

// notificationCreate creates a notification
function notificationCreate(json) {
    if (Notification.isSupported()) {
        elements[json.targetID] = new Notification(json.notificationOptions);
        elements[json.targetID].on('action', (event, index) => { client.write(json.targetID, consts.eventNames.notificationEventActioned, {index: index}) })
        elements[json.targetID].on('click', () => { client.write(json.targetID, consts.eventNames.notificationEventClicked) })
        elements[json.targetID].on('close', () => { client.write(json.targetID, consts.eventNames.notificationEventClosed) })
        elements[json.targetID].on('reply', (event, reply) => { client.write(json.targetID, consts.eventNames.notificationEventReplied, {reply: reply}) })
        elements[json.targetID].on('show', () => { client.write(json.targetID, consts.eventNames.notificationEventShown) })
    }
    client.write(json.targetID, consts.eventNames.notificationEventCreated)
}

// trayCreate creates a tray
function trayCreate(json) {
    elements[json.targetID] = new Tray(json.trayOptions.image);
    if (typeof json.trayOptions.tooltip !== "undefined") {
        elements[json.targetID].setToolTip(json.trayOptions.tooltip);
    }
    elements[json.targetID].on('click', (index, event) => { client.write(json.targetID, consts.eventNames.trayEventClicked, {"bounds":{x:event.x, y:event.y,width:event.width,height:event.height}})})
    elements[json.targetID].on('double-click', (index, event) => { client.write(json.targetID, consts.eventNames.trayEventDoubleClicked, {"bounds":{x:event.x, y:event.y,width:event.width,height:event.height}})})
    elements[json.targetID].on('right-click', (index, event) => { client.write(json.targetID, consts.eventNames.trayEventRightClicked, {"bounds":{x:event.x, y:event.y,width:event.width,height:event.height}})})
    client.write(json.targetID, consts.eventNames.trayEventCreated)
}

// windowCreate creates a new window
function windowCreate(json) {
    if (!json.windowOptions.webPreferences) {
        json.windowOptions.webPreferences = {}
    }
    json.windowOptions.webPreferences.nodeIntegration = true
    elements[json.targetID] = new BrowserWindow(json.windowOptions)
    if (typeof json.windowOptions.proxy !== "undefined") {
        elements[json.targetID].webContents.session.setProxy(json.windowOptions.proxy)
            .then(() => windowCreateFinish(json))
    } else {
        windowCreateFinish(json)
    }
}

// windowCreateFinish finishes creating a new window
function windowCreateFinish(json) {
    elements[json.targetID].setMenu(null)
    elements[json.targetID].loadURL(json.url, (typeof json.windowOptions.load !== "undefined" ? json.windowOptions.load :  {}));
    elements[json.targetID].on('blur', () => { client.write(json.targetID, consts.eventNames.windowEventBlur) })
    elements[json.targetID].on('close', (e) => {
        if (typeof json.windowOptions.custom !== "undefined") {
            if (typeof json.windowOptions.custom.messageBoxOnClose !== "undefined") {
                let buttonId = dialog.showMessageBox(null, json.windowOptions.custom.messageBoxOnClose)
                if (typeof json.windowOptions.custom.messageBoxOnClose.confirmId !== "undefined" && json.windowOptions.custom.messageBoxOnClose.confirmId !== buttonId) {
                    e.preventDefault()
                    return
                }
            }
            if (!quittingApp) {
                if (json.windowOptions.custom.minimizeOnClose) {
                    e.preventDefault();
                    elements[json.targetID].minimize();
                } else if (json.windowOptions.custom.hideOnClose) {
                    e.preventDefault();
                    elements[json.targetID].hide();
                }
            }
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
            var astilectron = {
                onMessageOnce: false,
                onMessage: function(callback) {
                    if (astilectron.onMessageOnce) {
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
                    astilectron.onMessageOnce = true
                },
                callbacks: {},
                counters: {},
                registerCallback: function(k, e, c, n) {
                    e.targetID = '`+ json.targetID +`';
                    if (typeof c !== "undefined") {
                        if (typeof astilectron.counters[k] === "undefined") {
                            astilectron.counters[k] = 1;
                        }
                        e.callbackId = String(astilectron.counters[k]++);
                        if (typeof astilectron.callbacks[k] === "undefined") {
                            astilectron.callbacks[k] = {};
                        }
                        astilectron.callbacks[k][e.callbackId] = c;
                    }
                    ipcRenderer.send(n, e);
                },
                executeCallback: function(k, message, args) {
                    if (typeof astilectron.callbacks[k][message.callbackId] !== "undefined") {
                        astilectron.callbacks[k][message.callbackId].apply(null, args);
                    }
                },
                sendMessage: function(message, callback) {
                    astilectron.registerCallback('` + consts.callbackNames.webContentsMessage + `', {message: message}, callback, '`+ consts.eventNames.ipcEventMessage +`');
                }
            };
            ipcRenderer.on('`+ consts.eventNames.ipcCmdMessageCallback +`', function(event, message) {
                astilectron.executeCallback('` + consts.callbackNames.webContentsMessage + `', message, [message.message]);
            });
            ipcRenderer.on('`+ consts.eventNames.ipcCmdLog+`', function(event, message) {
                console.log(message)
            });
            ` + (typeof json.windowOptions.custom !== "undefined" && typeof json.windowOptions.custom.script !== "undefined" ? json.windowOptions.custom.script : "") + `
            document.dispatchEvent(new Event('astilectron-ready'))`
        )
        sessionCreate(elements[json.targetID].webContents, json.sessionId)
        client.write(json.targetID, consts.eventNames.windowEventDidFinishLoad)
    })
    elements[json.targetID].webContents.on('did-get-redirect-request', (event, oldUrl, newUrl) => {
        client.write(json.targetID, consts.eventNames.windowEventDidGetRedirectRequest, {
            newUrl: newUrl,
            oldUrl: oldUrl
        })
    })
    elements[json.targetID].webContents.on('login', (event, request, authInfo, callback) => {
        event.preventDefault();
        registerCallback(json, consts.callbackNames.webContentsLogin, {authInfo: authInfo, request: request}, consts.eventNames.webContentsEventLogin, callback);
    })
    elements[json.targetID].webContents.on('will-navigate', (event, url) => {
        client.write(json.targetID, consts.eventNames.windowEventWillNavigate, {
            url: url
        })
    })
    if (typeof json.windowOptions.appDetails !== "undefined" && process.platform === "win32"){
        elements[json.targetID].setThumbarButtons([]);
        elements[json.targetID].setAppDetails(json.windowOptions.appDetails);
    }

    lastWindow = elements[json.targetID]
}

function registerCallback(json, k, e, n, c) {
    if (typeof counters[k] === "undefined") {
        counters[k] = 1;
    }
    e.callbackId = String(counters[k]++);
    if (typeof callbacks[k] === "undefined") {
        callbacks[k] = {};
    }
    callbacks[k][e.callbackId] = c;
    client.write(json.targetID, n, e);
}

function executeCallback(k, json, args) {
    if (typeof callbacks[k][json.callbackId] !== "undefined") {
        callbacks[k][json.callbackId].apply(null, args);
    }
}

function sessionCreate(webContents, sessionId) {
    elements[sessionId] = webContents.session
    elements[sessionId].on('will-download', () => { client.write(sessionId, consts.eventNames.sessionEventWillDownload) })
}

module.exports = {
  lastWindow,
  start
}
