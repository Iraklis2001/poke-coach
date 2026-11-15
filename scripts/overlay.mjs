import { spawn } from "node:child_process"
import net from "node:net"

const port = 3847

function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end()
      resolve(true)
    })
    socket.on("error", () => resolve(false))
  })
}

let server
if (!(await portOpen())) {
  server = spawn("npm", ["run", "dev"], { stdio: "inherit", shell: true })
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await portOpen()) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

const electron = spawn("npx", ["electron", "electron/main.cjs"], { stdio: "inherit", shell: true })
electron.on("exit", (code) => {
  if (server) server.kill()
  process.exit(code ?? 0)
})
