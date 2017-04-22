'use strict'

module.exports = {
    boundary: '--++__astilectron_boundary__++--',
    eventNames: {
        electronReady: "electron.ready",
        windowCreate: "window.create",
        windowCreateDone: "window.create.done",
        windowReadyToShow: "window.ready.to.show",
        windowShow: "window.show",
        windowShowDone: "window.show.done"
    },
    mainTargetID: 'main'
}
