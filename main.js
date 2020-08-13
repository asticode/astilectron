"use strict";

const { app } = require("electron");
const { start, lastWindow } = require("./index");

const address = process.argv[2]
const singleInstance = process.argv[3] === "true"

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

start(address, singleInstance);
