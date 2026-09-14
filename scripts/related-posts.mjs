// Print related approved public pages; never write or approve a post automatically.
import fs from 'node:fs'
import matter from 'gray-matter'
import {prepare} from './sync-content.mjs'
const cfg=JSON.parse(fs.readFileSync('.blog-local.json','utf8'))
const wanted=process.argv.slice(2).map(t=>t.toLowerCase())
const candidates=[...prepare(cfg.sourceRoot)].filter(([n])=>n.endsWith('.md')&&!n.endsWith('index.md')).map(([n,t])=>{const f=matter(t).data;return {n,title:f.title,score:f.tags.filter(t=>wanted.includes(t.toLowerCase())).length}}).filter(p=>p.score>0).sort((a,b)=>b.score-a.score).slice(0,5)
console.log('## 관련 글\n')
for(const p of candidates)console.log(`- [[${p.n.slice(0,-3)}|${p.title}]]`)
if(!candidates.length)console.log('관련된 공개 글이 아직 없습니다.')
