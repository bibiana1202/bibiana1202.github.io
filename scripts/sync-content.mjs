import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
export const hash=b=>crypto.createHash('sha256').update(b).digest('hex')
const inside=(base,p)=>p===base||p.startsWith(base+path.sep)
export function safeFile(base,relative){
 if(path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw Error('허용되지 않은 상대경로')
 if(fs.realpathSync(base)!==path.resolve(base))throw Error('심볼릭 링크 상위 경로 금지')
 const p=path.resolve(base,relative)
 if(!inside(base,p))throw Error('허용 폴더 밖 경로')
 let current=base
 if(fs.lstatSync(current).isSymbolicLink())throw Error('심볼릭 링크 폴더 금지')
 for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('심볼릭 링크 금지')}
 if(!fs.statSync(p).isFile())throw Error('일반 파일만 허용')
 return p
}
export function validateMarkdown(text,name){
 const parsed=matter(text),f=parsed.data
 const allowed=new Set(['title','date','tags','draft','description','featured'])
 if(Object.keys(f).some(k=>!allowed.has(k)))throw Error(`${name}: 비공개 또는 미허용 frontmatter 속성`)
 if(typeof f.title!=='string'||!f.title.trim()||f.draft!==false||!Array.isArray(f.tags)||f.tags.some(t=>typeof t!=='string'))throw Error(`${name}: frontmatter 형식 오류`)
 if(!(f.date instanceof Date)&&!(typeof f.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(f.date)))throw Error(`${name}: 날짜 필요`)
 if(/(?:\/Users\/|file:\/\/|(?:00_Drafts|90_Index|\.obsidian)\/|BEGIN.*PRIVATE KEY|sk-[A-Za-z0-9_-]{20,})/.test(text))throw Error(`${name}: 비공개 경로 또는 비밀값 의심 문자열`)
 const tree=unified().use(remarkParse).parse(parsed.content),refs=[]
 function walk(n){
  if(n.type==='html')throw Error(`${name}: 공개 본문 HTML은 별도 검토 필요`)
  if(['link','image','definition'].includes(n.type))refs.push(n.url)
  if(n.type==='text')for(const m of n.value.matchAll(/\[\[([^\]]+)\]\]/g))refs.push('wiki:'+m[1].split('|')[0])
  for(const c of n.children??[])walk(c)
 }
 walk(tree)
 return refs
}
export function prepare(sourceRoot,approvalOverride){
 const source=path.resolve(sourceRoot),published=path.join(source,'10_Published'),assets=path.join(source,'assets/public')
 const approvals=approvalOverride??JSON.parse(fs.readFileSync(path.join(source,'90_Index/공개승인.json'),'utf8'))
 const files=new Map(),imageFiles=new Map()
 for(const [name,expected] of Object.entries(approvals.files)){
  if(!name.endsWith('.md'))throw Error('승인 Markdown만 허용')
  const p=safeFile(published,name),data=fs.readFileSync(p)
  if(hash(data)!==expected)throw Error(`${name}: 승인 후 내용 변경 — 재검토 필요`)
  files.set(name,data.toString())
 }
 if(!files.has('index.md'))throw Error('승인된 홈 필요')
 for(const [name,original] of files){
  let text=original
  for(let ref of validateMarkdown(text,name)){
   const wiki=ref.startsWith('wiki:');if(wiki)ref=ref.slice(5)
   if(/^(https?:|mailto:|tel:)/i.test(ref)||ref.startsWith('#'))continue
   if(/^[a-z]+:/i.test(ref)||ref.startsWith('//'))throw Error(`${name}: 허용되지 않은 URL`)
   ref=decodeURIComponent(ref.split('#')[0].split('?')[0]);if(!ref)continue
   let resolved=path.resolve(wiki?published:path.dirname(path.join(published,name)),ref)
   if(inside(assets,resolved)){
    const rel=path.relative(assets,resolved).split(path.sep).join('/')
    if(!/\.(png|jpe?g|webp|gif)$/i.test(rel))throw Error('공개 이미지 형식은 PNG/JPEG/WebP/GIF만 허용')
    const data=fs.readFileSync(safeFile(assets,rel))
    if(hash(data)!==approvals.assets?.[rel])throw Error(`${name}: 승인되지 않은 이미지`)
    imageFiles.set('assets/'+rel,data)
    const dest=wiki?'assets/'+rel:path.relative(path.dirname(name),'assets/'+rel).split(path.sep).join('/')
    text=text.split(ref).join(dest)
   }else{
    if(!inside(published,resolved))throw Error(`${name}: 공개 대상 밖 링크`)
    let rel=path.relative(published,resolved).split(path.sep).join('/')
    if(!rel.endsWith('.md'))rel+='.md'
    if(!files.has(rel))throw Error(`${name}: 승인 목록에 없는 링크 ${rel}`)
   }
  }
  files.set(name,text)
 }
 return new Map([...files,...imageFiles])
}
export function synchronize(output,data,dryRun=false){
 if(fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink())throw Error('출력 심볼릭 링크 금지')
 const old=[]
 function scan(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('출력 내부 심볼릭 링크 금지');if(entry.isDirectory())scan(p);else old.push(path.relative(output,p))}}
 scan(output)
 const changes={write:[...data].filter(([n,b])=>!fs.existsSync(path.join(output,n))||hash(fs.readFileSync(path.join(output,n)))!==hash(b)).map(([n])=>n),remove:old.filter(n=>!data.has(n))}
 console.log(JSON.stringify(changes,null,2))
 if(dryRun)return changes
 const stage=fs.mkdtempSync(path.join(path.dirname(output),'.content-stage-'))
 try{
  for(const [name,body] of data){const p=path.join(stage,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body)}
  fs.rmSync(output,{recursive:true,force:true});fs.renameSync(stage,output)
 }finally{fs.rmSync(stage,{recursive:true,force:true})}
 return changes
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const config=JSON.parse(fs.readFileSync(path.join(root,'.blog-local.json'),'utf8'));synchronize(path.join(root,'content'),prepare(config.sourceRoot),process.argv.includes('--dry-run'))}
 catch(e){console.error('동기화 중단:',e.message);process.exitCode=1}
}
