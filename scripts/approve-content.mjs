import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import { hash, prepare, safeFile, validateMarkdown } from "./sync-content.mjs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function inside(base, candidate) {
  return candidate === base || candidate.startsWith(`${base}${path.sep}`)
}

function imageReferences(markdown) {
  const tree = unified().use(remarkParse).parse(matter(markdown).content)
  const references = []
  function walk(node) {
    if (node.type === "image") references.push(node.url)
    for (const child of node.children ?? []) walk(child)
  }
  walk(tree)
  return references
}

function sorted(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([left], [right]) => left.localeCompare(right)),
  )
}

export function buildApproval(sourceRoot, relativeFiles, currentApproval) {
  const source = path.resolve(sourceRoot)
  const published = path.join(source, "10_Published")
  const publicAssets = path.join(source, "assets", "public")
  const files = { ...currentApproval.files }
  const assets = { ...currentApproval.assets }
  const selectedFiles = {}
  const selectedAssets = {}

  for (const name of [...new Set(relativeFiles)]) {
    if (!name.endsWith(".md")) throw new Error(`Markdown 파일만 승인할 수 있습니다: ${name}`)
    const filePath = safeFile(published, name)
    const body = fs.readFileSync(filePath)
    const markdown = body.toString()
    validateMarkdown(markdown, name)
    selectedFiles[name] = hash(body)
    files[name] = selectedFiles[name]

    for (const originalUrl of imageReferences(markdown)) {
      if (/^(https?:|data:|#)/i.test(originalUrl)) continue
      if (/^[a-z]+:|^\/\//i.test(originalUrl)) {
        throw new Error(`${name}: 허용되지 않은 이미지 URL ${originalUrl}`)
      }
      const cleanUrl = decodeURIComponent(originalUrl.split("#")[0].split("?")[0])
      const resolved = path.resolve(path.dirname(filePath), cleanUrl)
      if (!inside(publicAssets, resolved)) {
        throw new Error(`${name}: 이미지는 assets/public 안에 있어야 합니다: ${originalUrl}`)
      }
      const relativeAsset = path.relative(publicAssets, resolved).split(path.sep).join("/")
      if (!/\.(png|jpe?g|webp|gif)$/i.test(relativeAsset)) {
        throw new Error(`${name}: 공개 이미지 형식은 PNG/JPEG/WebP/GIF만 허용합니다.`)
      }
      const assetBody = fs.readFileSync(safeFile(publicAssets, relativeAsset))
      selectedAssets[relativeAsset] = hash(assetBody)
      assets[relativeAsset] = selectedAssets[relativeAsset]
    }
  }

  const next = {
    ...currentApproval,
    files: sorted(files),
    assets: sorted(assets),
  }
  prepare(source, next)
  return { next, selectedFiles: sorted(selectedFiles), selectedAssets: sorted(selectedAssets) }
}

function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string", multiple: true },
      apply: { type: "boolean", default: false },
    },
    strict: true,
  })
  if (!values.file?.length) {
    throw new Error("사용법: npm run approve -- --file <10_Published 기준 경로> [--apply]")
  }

  const localConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".blog-local.json"), "utf8"),
  )
  const sourceRoot = fs.realpathSync(localConfig.sourceRoot)
  const indexRoot = path.join(sourceRoot, "90_Index")
  const approvalPath = safeFile(indexRoot, "공개승인.json")
  const current = JSON.parse(fs.readFileSync(approvalPath, "utf8"))
  const result = buildApproval(sourceRoot, values.file, current)

  console.log(
    JSON.stringify(
      {
        mode: values.apply ? "apply" : "preview",
        files: result.selectedFiles,
        assets: result.selectedAssets,
      },
      null,
      2,
    ),
  )

  if (!values.apply) {
    console.log("검토 후 같은 명령에 --apply를 붙이면 공개승인.json에 반영됩니다.")
    return
  }

  const temporary = `${approvalPath}.tmp-${process.pid}`
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(result.next, null, 2)}\n`, { flag: "wx" })
    fs.renameSync(temporary, approvalPath)
  } finally {
    fs.rmSync(temporary, { force: true })
  }
  console.log("공개승인.json 갱신 완료")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`승인 등록 중단: ${error.message}`)
    process.exitCode = 1
  }
}
