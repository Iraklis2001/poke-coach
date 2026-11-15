const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("slate", {
  setClickThrough(on) {
    ipcRenderer.send("click-through", on)
  },
  setOpacity(value) {
    ipcRenderer.send("opacity", value)
  },
  close() {
    ipcRenderer.send("close")
  },
  onClickThrough(callback) {
    const listener = (_event, on) => callback(Boolean(on))
    ipcRenderer.on("click-through", listener)
    return () => ipcRenderer.removeListener("click-through", listener)
  },
})
