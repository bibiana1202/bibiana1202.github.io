import fs from 'node:fs'
import path from 'node:path'
import { validateMarkdown } from './sync-content.mjs'
const base=path.resolve('content'),names=[]
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('링크 파일 금지');if(e.isDirectory())walk(p);else names.push(path.relative(base,p))}}
walk(base)
for(const n of names){
 if(n.endsWith('.md')){
  for(let ref of validateMarkdown(fs.readFileSync(path.join(base,n),'utf8'),n)){
   const wiki=ref.startsWith('wiki:');if(wiki)ref=ref.slice(5)
   if(/^(https?:|mailto:|tel:)/i.test(ref)||ref.startsWith('#'))continue
   ref=decodeURIComponent(ref.split('#')[0].split('?')[0]);if(!ref)continue
   const target=path.resolve(wiki?base:path.dirname(path.join(base,n)),ref)
   if(!target.startsWith(base+path.sep))throw Error('외부 경로 링크 금지')
   const rel=path.relative(base,target)
   if(!names.includes(rel)&&!names.includes(rel+'.md'))throw Error(`${n}: 링크 대상 없음 ${rel}`)
  }
 }else if(!n.startsWith('assets/')||!(/\.(png|jpe?g|webp|gif)$/i.test(n)))throw Error('미허용 콘텐츠 파일')
}
console.log(`공개 콘텐츠 검사 통과: ${names.length}개 파일`)
