import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../quartz.layout.ts', import.meta.url), 'utf8')
const definition = source.slice(source.indexOf('const explorerSort'), source.indexOf('// components shared'))
const js = ts.transpileModule(definition, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const sort = new Function(js + '; return explorerSort')()
const file = (title, date) => ({isFolder:false,displayName:title,data: date ? {date} : {}})
test('serialized browser sorter orders timestamps, ties and missing dates', () => {
 const browserSort = new Function('return ' + sort.toString())()
 const list = [file('A','2026-10-08T10:00:00+09:00'),file('Z','2026-10-08T11:00:00+09:00'),file('B','2026-10-08T10:00:00+09:00'),file('Missing')]
 assert.deepEqual(list.sort(browserSort).map(x=>x.displayName),['Z','A','B','Missing'])
})
test('category order remains fixed and folders precede posts', () => {
 const a={isFolder:true,slugSegment:'CS',displayName:'CS'}
 const b={isFolder:true,slugSegment:'Blockchain',displayName:'Blockchain'}
 assert.ok(sort(a,b)<0)
 assert.ok(sort(b,file('A','2027-01-01'))<0)
})
