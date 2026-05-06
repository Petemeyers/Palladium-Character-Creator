const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("engine", {
  call: (method, payload) => ipcRenderer.invoke("engine:call", { method, payload }),
});

