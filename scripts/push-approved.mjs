import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
const cfg=JSON.parse(fs.readFileSync('.blog-local.json','utf8'))
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
if(cfg.publicPushApproved!==true||!cfg.publishRemote)throw Error('최초 공개 저장소와 push에 대한 사용자 승인 설정이 없습니다.')
if(git('remote','get-url','origin')!==cfg.publishRemote)throw Error('승인된 저장소와 origin이 다릅니다.')
if(git('branch','--show-current')!=='main')throw Error('main 브랜치에서만 발행합니다.')
if(git('diff','--cached','--name-only'))throw Error('이미 staged 변경이 있습니다. 먼저 검토해 주세요.')
// Configuration changes require a separate review; routine publishing stages only exported content.
git('add','--','content')
if(git('diff','--cached','--name-only'))git('commit','-m','Publish approved blog content')
git('push','origin','main')
