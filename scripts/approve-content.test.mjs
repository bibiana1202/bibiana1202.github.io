import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { buildApproval } from "./approve-content.mjs"

const digest = (body) => crypto.createHash("sha256").update(body).digest("hex")
const markdown = (title, body = "") =>
  `---\ntitle: "${title}"\ndate: 2026-09-14\ntags: [test]\ndraft: false\n---\n\n${body}\n`

function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "approve-content-"))
  fs.mkdirSync(path.join(root, "10_Published"), { recursive: true })
  fs.mkdirSync(path.join(root, "assets", "public", "post"), { recursive: true })
  fs.mkdirSync(path.join(root, "90_Index"), { recursive: true })
  const index = markdown("Home")
  fs.writeFileSync(path.join(root, "10_Published", "index.md"), index)
  return {
    root,
    approval: { version: 1, note: "test", files: { "index.md": digest(index) }, assets: {} },
  }
}

test("registers only the named Markdown and images it references", () => {
  const { root, approval } = fixture()
  try {
    const post = markdown("Post", "![public](../assets/public/post/public.png)")
    fs.writeFileSync(path.join(root, "10_Published", "post.md"), post)
    fs.writeFileSync(path.join(root, "assets", "public", "post", "public.png"), "public")
    fs.writeFileSync(path.join(root, "assets", "public", "post", "unused.png"), "unused")
    const result = buildApproval(root, ["post.md"], approval)
    assert.equal(result.next.files["post.md"], digest(post))
    assert.deepEqual(Object.keys(result.selectedAssets), ["post/public.png"])
    assert.equal(result.next.assets["post/unused.png"], undefined)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects paths outside 10_Published", () => {
  const { root, approval } = fixture()
  try {
    assert.throws(() => buildApproval(root, ["../00_Drafts/private.md"], approval))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
