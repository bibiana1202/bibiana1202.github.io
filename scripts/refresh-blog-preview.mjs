import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const previewContent = path.join(projectRoot, ".preview-local", "content")

async function isInside(parent, candidate) {
  const relative = path.relative(await fs.realpath(parent), await fs.realpath(candidate))
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

async function copyPublishedContent() {
  await fs.rm(previewContent, { recursive: true, force: true })
  await fs.mkdir(previewContent, { recursive: true })
  await fs.cp(path.join(projectRoot, "content"), previewContent, {
    recursive: true,
    dereference: false,
    filter: async (source) => {
      const info = await fs.lstat(source)
      if (info.isSymbolicLink()) {
        throw new Error(`미리보기 입력에 심볼릭 링크를 사용할 수 없습니다: ${source}`)
      }
      return true
    },
  })
}

async function copyDraftImage({ sourceRoot, draftPath, draftName, rawUrl }) {
  const cleanUrl = rawUrl.split("#", 1)[0].split("?", 1)[0]
  const sourceImage = path.resolve(path.dirname(draftPath), decodeURIComponent(cleanUrl))
  const info = await fs.lstat(sourceImage)

  if (!info.isFile() || info.isSymbolicLink() || !(await isInside(sourceRoot, sourceImage))) {
    throw new Error(`허용되지 않은 초안 이미지입니다: ${rawUrl}`)
  }

  if (path.extname(sourceImage).toLowerCase() === ".svg") {
    const svg = await fs.readFile(sourceImage, "utf8")
    if (/<script|onload\s*=|javascript:/i.test(svg)) {
      throw new Error(`실행 가능한 코드가 포함된 SVG는 미리볼 수 없습니다: ${rawUrl}`)
    }
  }

  const digest = crypto.createHash("sha256").update(sourceImage).digest("hex").slice(0, 8)
  const filename = `${digest}-${path.basename(sourceImage)}`
  const assetDirectory = path.join(previewContent, "assets", "drafts", draftName)
  await fs.mkdir(assetDirectory, { recursive: true })
  await fs.copyFile(sourceImage, path.join(assetDirectory, filename))
  return `assets/drafts/${encodeURIComponent(draftName)}/${encodeURIComponent(filename)}`
}

async function renderDraft(sourceRoot, draftPath) {
  const filename = path.basename(draftPath)
  const draftName = path.basename(filename, ".md")
  let markdown = await fs.readFile(draftPath, "utf8")

  if (!markdown.trim()) {
    console.warn(`빈 초안 파일은 미리보기에서 건너뜁니다: ${filename}`)
    return false
  }

  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/)

  if (!frontmatter || !/^draft:\s*true\s*$/m.test(frontmatter[1])) {
    throw new Error(`${filename}은 draft: true인 초안이어야 합니다.`)
  }

  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
  const matches = [...markdown.matchAll(imagePattern)]
  for (const match of matches) {
    const rawUrl = match[2]
    if (/^(https?:|data:|#)/i.test(rawUrl)) continue
    const previewUrl = await copyDraftImage({ sourceRoot, draftPath, draftName, rawUrl })
    markdown = markdown.replace(match[0], `![${match[1]}](${previewUrl})`)
  }

  markdown = markdown.replace(/^draft:\s*true\s*$/m, "draft: false")
  const output = path.join(previewContent, "Drafts", filename)
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, markdown)
  return true
}

export async function refreshBlogPreview() {
  const localConfig = JSON.parse(
    await fs.readFile(path.join(projectRoot, ".blog-local.json"), "utf8"),
  )
  if (!localConfig.sourceRoot || !path.isAbsolute(localConfig.sourceRoot)) {
    throw new Error(".blog-local.json의 sourceRoot는 절대 경로여야 합니다.")
  }

  const sourceRoot = await fs.realpath(localConfig.sourceRoot)
  const draftRoot = path.join(sourceRoot, "00_Drafts")
  const entries = await fs.readdir(draftRoot, { withFileTypes: true })
  const draftFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.isSymbolicLink() &&
        entry.name.endsWith(".md"),
    )
    .map((entry) => path.join(draftRoot, entry.name))
    .sort((a, b) => a.localeCompare(b))

  await copyPublishedContent()
  let renderedDrafts = 0
  for (const draftPath of draftFiles) {
    if (await renderDraft(sourceRoot, draftPath)) renderedDrafts += 1
  }

  console.log(`Blog preview refreshed: published content + ${renderedDrafts} drafts`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await refreshBlogPreview()
}
