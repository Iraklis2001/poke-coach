const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("slateRegion", {
  choose(rect) {
    ipcRenderer.send("region-chosen", rect)
  },
  cancel() {
    ipcRenderer.send("region-cancel")
  },
})
