"use strict";

const { app } = require("electron");
const { start, getLastWindow, client, consts } = require("./index");

// edge case when the program is launched without arguments
if (process.argv.length == 1) {
  app.requestSingleInstanceLock();
  app.quit();
  return;
}

if (process.argv[3] === "true") {
  // Lock
  const singlesInstanceLock = app.requestSingleInstanceLock();
  if (!singlesInstanceLock) {
    app.quit();
    return;
  }

  // Someone tried to run a second instance, we should focus our window.
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    client.write(consts.targetIds.app, consts.eventNames.appEventSecondInstance, {secondInstance: {commandLine: commandLine, workingDirectory: workingDirectory}})
    const lastWindow = getLastWindow()
    if (lastWindow) {
      if (lastWindow.isMinimized()) lastWindow.restore();
      lastWindow.show();
    }
  });
}

// Command line switches
let idx = 4;
for (let i = idx; i < process.argv.length; i++) {
  let s = process.argv[i].replace(/^[\-]+/g, "");
  let v;
  if (
    typeof process.argv[i + 1] !== "undefined" &&
    !process.argv[i + 1].startsWith("-")
  ) {
    v = process.argv[i + 1];
    i++;
  }
  app.commandLine.appendSwitch(s, v);
}

start();
