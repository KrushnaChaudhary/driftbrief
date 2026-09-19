import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { context, serializeBrief } from '../src/context.js';
import { hash, safePath } from '../src/fs.js';
import { reconcile, publish, loadSnapshot, stateDir } from '../src/state.js';
import { parseDocument } from '../src/parse.js';
import { render } from '../src/viewer.js';
import { containsSecret } from '../src/scan.js';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'driftbrief test Ω '));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file: string, value: string) => { await fs.mkdir(path.dirname(path.join(root,file)), { recursive:true }); await fs.writeFile(path.join(root,file),value); };
  return { root, write };
}
const git = (root: string, args: string[]) => execFileSync('git', args, { cwd:root, windowsHide:true, encoding:'utf8' });

test('WASM parsers support JS, TS, TSX and Python; malformed syntax is disclosed', async () => {
  for (const [file,text,name] of [ ['a.js','function login() { return 1; }','login'], ['a.ts','interface Customer { id: string }','Customer'], ['a.tsx','function Card() { return <div/>; }','Card'], ['a.py','def calculate_total(x):\n    return x * 2\n','calculate_total'] ]) {
    const doc = await parseDocument(file,text);
    assert.notEqual(doc.parser, 'text', 'WASM grammar must load: ' + file);
    assert.ok(doc.symbols.some(s=>s.name===name));
  }
  assert.equal((await parseDocument('a.ts','function ( {')).parseIncomplete,true);
});
test('retrieval verifies source and discovers edits, additions, renames without watchers', async t => {
  const { root,write } = await fixture(t);
  await write('src/auth.ts','export function authenticateUser() {\n return "old-auth";\n}\n');
  const first = await context(root,{ query:'authenticateUser' });
  assert.equal(first.evidence[0].path,'src/auth.ts');
  assert.equal(first.evidence[0].sha256,hash(await fs.readFile(path.join(root,'src/auth.ts'))));
  await fs.rename(path.join(root,'src/auth.ts'),path.join(root,'src/session.ts'));
  await write('src/session.ts','export function authenticateSession() {\n return "new-auth";\n}\n');
  await write('src/invoice.py','def invoice_total():\n    return 42\n');
  const second = await context(root,{ query:'authenticateSession invoice_total' });
  assert.ok(second.evidence.some(e=>e.path==='src/session.ts'));
  assert.ok(second.evidence.some(e=>e.path==='src/invoice.py'));
  assert.ok(second.invalidated.some(e=>e.path==='src/auth.ts'));
  assert.ok(!second.evidence.some(e=>e.excerpt.includes('old-auth')));
  await write('src/invoice.py','def previously_absent_keyword():\n    return 12\n');
  assert.ok((await context(root,{query:'previously_absent_keyword'})).evidence.some(e=>e.path==='src/invoice.py'));
});
test('source changed between ranking and reading is omitted', async t => {
  const { root,write }=await fixture(t);
  await write('auth.ts','export function authenticate() { return 1; }');
  const result=await context(root,{query:'authenticate',afterRank:()=>write('auth.ts','export function authenticate() { return 2; }')});
  assert.equal(result.evidence.length,0);
  assert.equal(result.invalidated[0].reason,'source-changed-since-index');
});
test('hash changes with same size and restored timestamp are detected', async t => {
  const {root,write}=await fixture(t); await write('x.ts','function checksum() { return 1; }');
  await context(root,{query:'checksum'}); const stat=await fs.stat(path.join(root,'x.ts'));
  await write('x.ts','function checksum() { return 2; }'); await fs.utimes(path.join(root,'x.ts'),stat.atime,stat.mtime);
  assert.match((await context(root,{query:'checksum'})).evidence[0].excerpt,/return 2/);
});
test('manifest facts distinguish npm scripts and Python entrypoints', async t => {
  const {root,write}=await fixture(t);
  await write('package.json',JSON.stringify({scripts:{test:'vitest run'}, dependencies:{widget:'^2'}}));
  await write('pyproject.toml','[project.scripts]\nwidget = "widget.cli:main"\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n');
  const brief=await context(root,{query:'test widget',paths:['package.json','pyproject.toml']});
  assert.ok(brief.evidence.flatMap(e=>e.facts).some(f=>f.kind==='declared-script'&&f.value==='vitest run'));
  assert.ok(brief.evidence.flatMap(e=>e.facts).some(f=>f.kind==='python-entrypoint'));
});
test('secrets, binaries, ignores, nested ignores and large files are excluded', async t => {
  const {root,write}=await fixture(t);
  await write('.gitignore','ignored/\n'); await write('src/.gitignore','private.ts\n');
  await write('ignored/secret.ts','function tokenNeedle(){}'); await write('src/private.ts','function tokenNeedle(){}');
  await write('.env','tokenNeedle=yes'); await write('node_modules/pkg/index.js','function tokenNeedle(){}');
  await write('src/exposed.ts',"const api_key = '" + 'sk-'+'a'.repeat(40) + "'; // tokenNeedle");
  await write('large.txt','tokenNeedle'.repeat(100000)); await write('binary.dat','tokenNeedle\0abc');
  await write('safe.ts','function tokenNeedle() { return true; }');
  const brief=await context(root,{query:'tokenNeedle'});
  assert.deepEqual(brief.evidence.map(e=>e.path),['safe.ts']); assert.ok(brief.omissions['possible-secret']);
  assert.ok(!JSON.stringify(await loadSnapshot(root)).includes('sk-'+'a'.repeat(40)));
  assert.equal(containsSecret('const normal = "hello"'),false);
});
test('tracked secrets excluded; git index and source bytes unchanged', async t => {
  const {root,write}=await fixture(t); git(root,['init','-q']);
  await write('src.ts','export function greeting(){ return "hello"; }'); await write('.env','GREETING=secret');
  git(root,['add','--all']); const before=await fs.readFile(path.join(root,'.git/index'));
  const source=await fs.readFile(path.join(root,'src.ts'));
  const result=await context(root,{query:'greeting'});
  assert.ok(!result.evidence.some(e=>e.path==='.env'));
  assert.deepEqual(await fs.readFile(path.join(root,'.git/index')),before);
  assert.deepEqual(await fs.readFile(path.join(root,'src.ts')),source);
});
test('symlink source and state escape rejected', async t => {
  const {root}=await fixture(t); const other=await fixture(t); await other.write('outside.ts','function escapeNeedle(){}');
  try { await fs.symlink(other.root,path.join(root,'external'),process.platform==='win32'?'junction':'dir'); } catch(e:any) { if(e.code==='EPERM'){t.skip('OS disallows symlinks');return;} throw e; }
  assert.equal((await context(root,{query:'escapeNeedle'})).evidence.length,0);
  await assert.rejects(safePath(root,'../escape'));
  const fresh=await fixture(t); await fs.symlink(other.root,path.join(fresh.root,'.driftbrief'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(context(fresh.root,{query:'escapeNeedle'}));
});
test('package ignore applies to tracked source', async t=>{
  const {root,write}=await fixture(t);git(root,['init','-q']); await write('private.ts','function specialPrivate(){}');git(root,['add','private.ts']);
  await write('.driftbriefignore','private.ts\n'); assert.equal((await context(root,{query:'specialPrivate'})).evidence.length,0);
});
test('response footprint includes metadata and unrelated queries return nothing',async t=>{
  const {root,write}=await fixture(t);for(let i=0;i<12;i++)await write('src/a'+i+'.ts','function tokenizer(){\n'+('return "some text";\n'.repeat(15))+'}\n');
  for(const cap of [1024,2000,4000,8000]) {
    const brief=await context(root,{query:'tokenizer',maxBytes:cap});const text=serializeBrief(brief,cap);
    assert.ok(Buffer.byteLength(text)<=cap);assert.equal(Buffer.byteLength(text),brief.footprint.bytes);
  }
  assert.equal((await context(root,{query:'hello thanks'})).evidence.length,0);
});
test('cached hook rejects missing cache and changed source', async t=>{
  const {root,write}=await fixture(t);await write('auth.py','def authenticate():\n    return 1\n');
  assert.equal((await context(root,{query:'authenticate',hook:true})).coverage,'unavailable');
  await context(root,{query:'authenticate'});await write('auth.py','def authenticate():\n    return 2\n');
  assert.equal((await context(root,{query:'authenticate',hook:true})).evidence.length,0);
});
test('corrupt cache rebuilt; unpublished generation ignored', async t=>{
  const {root,write}=await fixture(t);await write('x.py','def repair_cache():\n    return 1\n');
  await context(root,{query:'repair_cache'});await write(stateDir+'/current.json','{broken');
  assert.equal(await loadSnapshot(root),null);
  assert.equal((await context(root,{query:'repair_cache'})).evidence.length,1);
  await write(stateDir+'/generations/00000000-0000-0000-0000-000000000000.json','{partial');
  assert.equal((await loadSnapshot(root))?.documents.length,1);
});
test('simultaneous publication and stale writer-lock recovery', async t=>{
  const {root,write}=await fixture(t);await write('shared.ts','function sharedEvidence(){}');
  const a=await reconcile(root), b=await reconcile(root);await Promise.all([publish(root,a),publish(root,b)]);
  assert.ok(await loadSnapshot(root));
  const lockPath=path.join(root,'.driftbrief/state.lock');
  await fs.mkdir(lockPath);const stale=new Date(Date.now()-60000);await fs.utimes(lockPath,stale,stale);
  assert.equal(await publish(root,await reconcile(root)),true);
});
test('branch switch and worktrees isolate context', async t=>{
  const {root,write}=await fixture(t);git(root,['init','-q','-b','main']);git(root,['config','user.name','DriftBrief Test']);git(root,['config','user.email','test@example.invalid']);
  await write('.gitignore','.driftbrief/\n');await write('x.ts','function branchFeature(){return "main";}');git(root,['add','.']);git(root,['commit','-qm','main']);
  await context(root,{query:'branchFeature'});git(root,['checkout','-qb','feature']);await write('x.ts','function branchFeature(){return "feature";}');git(root,['add','x.ts']);git(root,['commit','-qm','feature']);
  assert.equal((await context(root,{query:'branchFeature',hook:true})).coverage,'unavailable');
  assert.match((await context(root,{query:'branchFeature'})).evidence[0].excerpt,/feature/);
  const other=path.join(root,'..',path.basename(root)+'-worktree');git(root,['worktree','add','--quiet',other,'main']);
  try {
    const otherResult=await context(other,{query:'branchFeature'});assert.match(otherResult.evidence[0].excerpt,/"main"/);
    assert.notEqual((await loadSnapshot(root))?.identity.id,(await loadSnapshot(other))?.identity.id);
  } finally { git(root,['worktree','remove','--force',other]); }
});
test('offline viewer escapes hostile source', async t=>{
  const {root,write}=await fixture(t);await write('hostile.ts','// hostileSource </script><img src=x onerror=alert(1)>\nfunction hostileSource(){}');
  const result=await context(root,{query:'hostileSource'});const html=render([result]);
  assert.ok(html.includes('&lt;/script&gt;&lt;img'));assert.ok(!html.includes('<img src=x'));
  assert.ok(!/src="https?:/.test(html));assert.ok(html.includes('Content-Security-Policy'));
});
