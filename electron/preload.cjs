const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("connector", {
  getState: () => ipcRenderer.invoke("connector:getState"),
  start: () => ipcRenderer.invoke("connector:start"),
  stop: () => ipcRenderer.invoke("connector:stop"),
  openConfig: () => ipcRenderer.invoke("connector:openConfig"),
  openEnv: () => ipcRenderer.invoke("connector:openEnv"),
  openWebsite: () => ipcRenderer.invoke("connector:openWebsite"),
  updateCode: () => ipcRenderer.invoke("connector:updateCode"),
  onLog: (callback) => ipcRenderer.on("connector:log", (_event, value) => callback(value)),
  onStatus: (callback) => ipcRenderer.on("connector:status", (_event, value) => callback(value)),
});
