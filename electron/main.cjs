const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron")
const path = require("path")

const START_URL = process.env.SLATE_URL || "http://127.0.0.1:3847/overlay"

let passThrough = false

function createWindow() {
  const win = new BrowserWindow({
    width: 320,
    height: 360,
    minWidth: 320,
    minHeight: 520,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.setAlwaysOnTop(true, "screen-saver")
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  function setPassThrough(next) {
    passThrough = next
    win.setIgnoreMouseEvents(passThrough, { forward: true })
    if (!win.isDestroyed()) win.webContents.send("click-through", passThrough)
  }

  ipcMain.removeAllListeners("click-through")
  ipcMain.removeAllListeners("opacity")
  ipcMain.removeAllListeners("close")
  ipcMain.on("click-through", (_event, on) => setPassThrough(Boolean(on)))
  ipcMain.on("opacity", (_event, value) => {
    const next = Math.min(1, Math.max(0.45, Number(value) || 1))
    win.setOpacity(next)
  })
  ipcMain.on("close", () => {
    if (!win.isDestroyed()) win.close()
  })

  globalShortcut.unregister("Alt+Shift+S")
  globalShortcut.register("Alt+Shift+S", () => setPassThrough(!passThrough))

  win.on("closed", () => {
    globalShortcut.unregister("Alt+Shift+S")
  })

  win.loadURL(START_URL)
}

app.whenReady().then(createWindow)
app.on("window-all-closed", () => app.quit())
