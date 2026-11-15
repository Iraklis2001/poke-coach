const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } = require("electron")
const path = require("path")

const START_URL = process.env.SLATE_URL || "http://127.0.0.1:3847/overlay"

let passThrough = false
let overlay = null

function createWindow() {
  const win = new BrowserWindow({
    width: 320,
    height: 430,
    minWidth: 300,
    minHeight: 280,
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

  overlay = win
  win.setContentProtection(true)
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
    overlay = null
    globalShortcut.unregister("Alt+Shift+S")
  })

  win.loadURL(START_URL)
}

function virtualScreen() {
  const displays = screen.getAllDisplays()
  const x = Math.min(...displays.map((display) => display.bounds.x))
  const y = Math.min(...displays.map((display) => display.bounds.y))
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width))
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height))
  return { x, y, width: right - x, height: bottom - y }
}

function showOverlay() {
  if (overlay && !overlay.isDestroyed()) overlay.show()
}

function pickRegion() {
  if (overlay && !overlay.isDestroyed()) overlay.hide()
  const area = virtualScreen()
  const picker = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "region-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  picker.setAlwaysOnTop(true, "screen-saver")
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      ipcMain.removeListener("region-chosen", onChoose)
      ipcMain.removeListener("region-cancel", onCancel)
      if (!picker.isDestroyed()) picker.close()
      showOverlay()
      resolve(value)
    }
    const onChoose = (_event, rect) => {
      if (!rect || rect.width < 12 || rect.height < 12) return finish(null)
      finish({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    }
    const onCancel = () => finish(null)
    ipcMain.on("region-chosen", onChoose)
    ipcMain.on("region-cancel", onCancel)
    picker.on("closed", () => finish(null))
    picker.loadFile(path.join(__dirname, "region.html"))
  })
}

let reader = null

async function recognize(png) {
  if (!reader) {
    const { createWorker } = require("tesseract.js")
    reader = createWorker("eng", 1, {
      cachePath: path.join(app.getPath("userData"), "tesseract"),
    })
      .then(async (worker) => {
        await worker.setParameters({ tessedit_pageseg_mode: "6" })
        return worker
      })
      .catch((error) => {
        reader = null
        throw error
      })
  }
  const worker = await reader
  const result = await worker.recognize(png)
  return result.data.text || ""
}

async function captureRegion(region) {
  const display = screen.getDisplayMatching(region)
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  })
  const source = sources.find((item) => item.display_id === String(display.id)) || sources[0]
  if (!source) return ""
  const image = source.thumbnail
  const size = image.getSize()
  if (!size.width || !size.height) return ""
  const scaleX = size.width / display.bounds.width
  const scaleY = size.height / display.bounds.height
  const x = Math.max(0, Math.min(size.width - 1, Math.round((region.x - display.bounds.x) * scaleX)))
  const y = Math.max(0, Math.min(size.height - 1, Math.round((region.y - display.bounds.y) * scaleY)))
  const cropped = image.crop({
    x,
    y,
    width: Math.max(1, Math.min(size.width - x, Math.round(region.width * scaleX))),
    height: Math.max(1, Math.min(size.height - y, Math.round(region.height * scaleY))),
  })
  const croppedSize = cropped.getSize()
  const scaled = cropped.resize({
    width: Math.max(1, croppedSize.width * 3),
    height: Math.max(1, croppedSize.height * 3),
    quality: "best",
  })
  return recognize(scaled.toPNG())
}

ipcMain.handle("pick-region", () => pickRegion())
ipcMain.handle("read-region", async (_event, region) => {
  try {
    const text = await captureRegion(region)
    return { text }
  } catch (error) {
    return { text: "", error: error instanceof Error ? error.message : "The battle text could not be read." }
  }
})

app.whenReady().then(createWindow)
app.on("window-all-closed", () => app.quit())
