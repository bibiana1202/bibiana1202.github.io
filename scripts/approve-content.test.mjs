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

test("new registration gets Korean timestamp without mutating preview; reapproval preserves it", () => {
  const { root, approval } = fixture()
  try {
    const target = path.join(root, "10_Published", "post.md")
    const original = markdown("Post")
    fs.writeFileSync(target, original)
    const result = buildApproval(root, ["post.md"], approval, {
      stampNew: true, now: new Date("2026-10-08T23:30:00Z"),
    })
    assert.equal(fs.readFileSync(target, "utf8"), original)
    const stamped = result.sourceUpdates.get("post.md")
    assert.match(stamped.toString(), /date: "2026-10-09T08:30:00.000\+09:00"/)
    assert.equal(result.next.files["post.md"], digest(stamped))
    fs.writeFileSync(target, stamped)
    const again = buildApproval(root, ["post.md", "index.md"], result.next, {
      stampNew: true, now: new Date("2026-11-01T00:00:00Z"),
    })
    assert.equal(again.sourceUpdates.size, 0)
    assert.equal(again.next.files["post.md"], result.next.files["post.md"])
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("preserves an explicitly assigned registration timestamp on first approval", () => {
  const { root, approval } = fixture()
  try {
    const body = markdown("Post").replace('date: 2026-09-14', 'date: "2026-10-08T10:30:00+09:00"')
    fs.writeFileSync(path.join(root, "10_Published", "post.md"), body)
    const result = buildApproval(root, ["post.md"], approval, { stampNew: true, now: new Date("2026-10-09T00:00:00Z") })
    assert.equal(result.sourceUpdates.size, 0)
    assert.equal(result.next.files["post.md"], digest(body))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
