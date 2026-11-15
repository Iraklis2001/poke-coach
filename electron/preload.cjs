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
  pickRegion() {
    return ipcRenderer.invoke("pick-region")
  },
  readRegion(region) {
    return ipcRenderer.invoke("read-region", region)
  },
  setCompact(compact) {
    ipcRenderer.send("set-compact", Boolean(compact))
  },
  setShareVisible(shareVisible) {
    ipcRenderer.send("share-visible", Boolean(shareVisible))
  },
  snap(corner) {
    ipcRenderer.send("snap", corner)
  },
})
