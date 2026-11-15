const { desktopCapturer, nativeImage, screen, app } = require("electron")

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
  return (value.match(/[A-Za-z]/g) || []).length + (value.match(/\d/g) || []).length
}

async function getWorker() {
  if (!reader) {
    const { createWorker } = require("tesseract.js")
    reader = createWorker("eng", 1, {
      cachePath: pathJoinUserData(),
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
  return reader
}

function pathJoinUserData() {
  const path = require("path")
  return path.join(app.getPath("userData"), "tesseract")
}

async function recognize(png, { line = false } = {}) {
  const worker = await getWorker()
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
  const short = croppedSize.height > 0 && croppedSize.height <= 80
  const zoom = short ? 5 : 3
  const scaled = cropped.resize({
    width: Math.max(1, croppedSize.width * zoom),
    height: Math.max(1, croppedSize.height * zoom),
    quality: "best",
  })
  return recognize(scaled.toPNG(), { line: short })
}

module.exports = { captureRegion }
