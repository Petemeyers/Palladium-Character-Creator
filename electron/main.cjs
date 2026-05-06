const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { Worker } = require("worker_threads");

const isDev = !app.isPackaged;

let engineWorker = null;
let nextReqId = 1;
const pending = new Map();

function startEngineWorker() {
  const workerPath = path.join(__dirname, "engine.worker.cjs");
  engineWorker = new Worker(workerPath);

  engineWorker.on("message", (msg) => {
    const { id, ok, result, error } = msg || {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);

    if (ok) entry.resolve(result);
    else entry.reject(new Error(error || "Engine worker error"));
  });

  engineWorker.on("error", (err) => {
    console.error("Engine worker crashed:", err);
  });

  engineWorker.on("exit", (code) => {
    console.error("Engine worker exited:", code);
    engineWorker = null;
  });
}

function callEngine(method, payload) {
  if (!engineWorker) startEngineWorker();

  const id = nextReqId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    engineWorker.postMessage({ id, method, payload });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  startEngineWorker();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("engine:call", async (_evt, { method, payload }) => {
  return await callEngine(method, payload);
});

