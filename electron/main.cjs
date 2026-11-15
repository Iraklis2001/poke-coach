const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, nativeImage, screen } = require("electron")
const fs = require("fs")
const path = require("path")

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
    // Solid window (not transparent). Discord's whole-screen capture often
    // skips layered/transparent Electron windows even when content protection is off.
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

  function keepOnTop() {
    if (win.isDestroyed()) return
    // screen-saver beats most game windows; floating let PRO bury Slate.
    win.setAlwaysOnTop(true, "screen-saver")
    try {
      win.moveTop()
    } catch {
      // moveTop is best-effort on some Windows builds
    }
  }

  function setPassThrough(next) {
    passThrough = next
    win.setIgnoreMouseEvents(passThrough, { forward: true })
    if (!win.isDestroyed()) win.webContents.send("click-through", passThrough)
  }

  keepOnTop()

  ipcMain.removeAllListeners("click-through")
  ipcMain.removeAllListeners("opacity")
  ipcMain.removeAllListeners("close")
  ipcMain.removeAllListeners("set-compact")
  ipcMain.removeAllListeners("snap")
  ipcMain.on("click-through", (_event, on) => setPassThrough(Boolean(on)))
  ipcMain.on("opacity", (_event, value) => {
    const next = Math.min(1, Math.max(0.5, Number(value) || 1))
    win.setOpacity(next)
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

  globalShortcut.unregister("Alt+Shift+S")
  globalShortcut.register("Alt+Shift+S", () => setPassThrough(!passThrough))

  win.on("moved", saveBounds)
  win.on("resized", saveBounds)
  win.on("show", keepOnTop)
  win.on("focus", () => {
    setPassThrough(false)
    keepOnTop()
  })
  // When you click the game, Windows drops Slate under it — pin it back without stealing keys.
  win.on("blur", () => {
    setTimeout(keepOnTop, 50)
  })
  const pinTimer = setInterval(keepOnTop, 2000)
  win.on("closed", () => {
    clearInterval(pinTimer)
    overlay = null
    globalShortcut.unregister("Alt+Shift+S")
  })

  setPassThrough(false)
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

function boostForOcr(png) {
  try {
    const image = nativeImage.createFromBuffer(png)
    const { width, height } = image.getSize()
    if (!width || !height) return png
    const bgra = Buffer.from(image.toBitmap())
    // PRO summaries are light text on a dark panel. Flip to black text on white.
    for (let i = 0; i + 3 < bgra.length; i += 4) {
      const gray = 0.114 * bgra[i] + 0.587 * bgra[i + 1] + 0.299 * bgra[i + 2]
      const value = gray < 150 ? 255 : 0
      bgra[i] = value
      bgra[i + 1] = value
      bgra[i + 2] = value
    }
    return nativeImage.createFromBitmap(bgra, { width, height }).toPNG()
  } catch {
    return png
  }
}

function ocrScore(value) {
  // Letters for names/moves; digits for Lv and PP.
  return (value.match(/[A-Za-z]/g) || []).length + (value.match(/\d/g) || []).length
}

async function recognize(png, { line = false } = {}) {
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
  const boosted = boostForOcr(png)
  // 7 = nameplate line. 6/4 = summary panels (sparse / single column).
  const modes = line ? ["7"] : ["6", "4"]
  let best = ""
  let bestScore = -1
  for (const mode of modes) {
    await worker.setParameters({
      tessedit_pageseg_mode: mode,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./:'- ♂♀",
    })
    for (const image of [boosted, png]) {
      const result = await worker.recognize(image)
      const text = result.data.text || ""
      const score = ocrScore(text)
      if (score > bestScore) {
        best = text
        bestScore = score
      }
    }
  }
  // Clear whitelist so later calls are not stuck filtered.
  await worker.setParameters({ tessedit_char_whitelist: "" })
  return best
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
  // Small foe name boxes need a bigger upscale for Tesseract.
  const short = croppedSize.height > 0 && croppedSize.height <= 80
  const zoom = short ? 5 : 3
  const scaled = cropped.resize({
    width: Math.max(1, croppedSize.width * zoom),
    height: Math.max(1, croppedSize.height * zoom),
    quality: "best",
  })
  return recognize(scaled.toPNG(), { line: short })
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
