import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import chokidar from "chokidar"
import { refreshBlogPreview } from "./refresh-blog-preview.mjs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const localConfig = JSON.parse(await fs.readFile(path.join(projectRoot, ".blog-local.json"), "utf8"))
const sourceRoot = localConfig.sourceRoot

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `${port} 포트가 이미 사용 중입니다. 기존 미리보기 터미널에서 Ctrl+C를 누른 뒤 다시 실행하세요.`,
          ),
        )
      } else {
        reject(error)
      }
    })
    server.once("listening", () => server.close(resolve))
    server.listen(port, "127.0.0.1")
  })
}

try {
  await Promise.all([assertPortAvailable(8080), assertPortAvailable(3001)])
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

await refreshBlogPreview()

const quartz = spawn(
  process.execPath,
  [
    "quartz/bootstrap-cli.mjs",
    "build",
    "--serve",
    "--port",
    "8080",
    "--wsPort",
    "3001",
    "-d",
    ".preview-local/content",
    "-o",
    ".preview-local/public",
  ],
  { cwd: projectRoot, stdio: "inherit" },
)

let refreshTimer
const watcher = chokidar.watch(
  [
    path.join(projectRoot, "content"),
    path.join(sourceRoot, "00_Drafts"),
    path.join(sourceRoot, "80_Sources"),
    path.join(sourceRoot, "assets"),
  ],
  {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  },
)

watcher.on("all", () => {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(async () => {
    try {
      await refreshBlogPreview()
    } catch (error) {
      console.error(error)
    }
  }, 200)
})

async function stop(signal) {
  clearTimeout(refreshTimer)
  await watcher.close()
  quartz.kill(signal)
}

process.on("SIGINT", () => void stop("SIGINT"))
process.on("SIGTERM", () => void stop("SIGTERM"))
quartz.on("exit", (code) => process.exit(code ?? 0))
