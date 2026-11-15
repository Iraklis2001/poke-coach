const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron")
const fs = require("fs")
const path = require("path")
const { captureRegion } = require("./ocr.cjs")

const START_URL = process.env.SLATE_URL || "http://127.0.0.1:3847/overlay"
const BOUNDS_FILE = () => path.join(app.getPath("userData"), "overlay-bounds.json")

let passThrough = false
let overlay = null
let compact = true

function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(BOUNDS_FILE(), "utf8"))
  } catch {
    return null
  }
}

function saveBounds() {
  if (!overlay || overlay.isDestroyed()) return
  try {
    fs.writeFileSync(BOUNDS_FILE(), JSON.stringify({ ...overlay.getBounds(), compact }))
  } catch {
    // ignore disk errors
  }
}

function keepWindowOnTop(win) {
  if (win.isDestroyed()) return
  win.setAlwaysOnTop(true, "screen-saver")
  try {
    win.moveTop()
  } catch {
    // moveTop is best-effort on some Windows builds
  }
}

function createWindow() {
  const saved = loadBounds()
  compact = saved?.compact ?? true
  const win = new BrowserWindow({
    x: saved?.x,
    y: saved?.y,
    width: compact ? 420 : saved?.width || 480,
    height: compact ? 240 : saved?.height || 520,
    minWidth: 360,
    minHeight: 180,
    frame: false,
    // Solid window so Discord whole-screen share can capture Slate.
    transparent: false,
    alwaysOnTop: true,
    hasShadow: true,
    resizable: true,
    backgroundColor: "#f8f8f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  overlay = win
  win.setContentProtection(false)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  function setPassThrough(next) {
    passThrough = next
    win.setIgnoreMouseEvents(passThrough, { forward: true })
    if (!win.isDestroyed()) win.webContents.send("click-through", passThrough)
  }

  keepWindowOnTop(win)
  wireWindowIpc(win, setPassThrough)

  globalShortcut.unregister("Alt+Shift+S")
  globalShortcut.register("Alt+Shift+S", () => setPassThrough(!passThrough))

  win.on("moved", saveBounds)
  win.on("resized", saveBounds)
  win.on("show", () => keepWindowOnTop(win))
  win.on("focus", () => {
    setPassThrough(false)
    keepWindowOnTop(win)
  })
  win.on("blur", () => {
    setTimeout(() => keepWindowOnTop(win), 50)
  })
  const pinTimer = setInterval(() => keepWindowOnTop(win), 2000)
  win.on("closed", () => {
    clearInterval(pinTimer)
    overlay = null
    globalShortcut.unregister("Alt+Shift+S")
  })

  setPassThrough(false)
  win.loadURL(START_URL)
}

function wireWindowIpc(win, setPassThrough) {
  for (const channel of ["click-through", "opacity", "close", "set-compact", "snap"]) {
    ipcMain.removeAllListeners(channel)
  }

  ipcMain.on("click-through", (_event, on) => setPassThrough(Boolean(on)))
  ipcMain.on("opacity", (_event, value) => {
    win.setOpacity(Math.min(1, Math.max(0.5, Number(value) || 1)))
  })
  ipcMain.on("close", () => {
    if (!win.isDestroyed()) win.close()
  })
  ipcMain.on("set-compact", (_event, next) => {
    compact = Boolean(next)
    const bounds = win.getBounds()
    if (compact) win.setSize(420, 240, true)
    else win.setSize(Math.max(bounds.width, 480), Math.max(bounds.height, 520), true)
    saveBounds()
  })
  ipcMain.on("snap", (_event, corner) => {
    const display = screen.getDisplayMatching(win.getBounds())
    const work = display.workArea
    const size = win.getBounds()
    const gap = 12
    const places = {
      tl: { x: work.x + gap, y: work.y + gap },
      tr: { x: work.x + work.width - size.width - gap, y: work.y + gap },
      bl: { x: work.x + gap, y: work.y + work.height - size.height - gap },
      br: { x: work.x + work.width - size.width - gap, y: work.y + work.height - size.height - gap },
    }
    const place = places[corner]
    if (place) win.setPosition(Math.round(place.x), Math.round(place.y))
    saveBounds()
  })
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
