import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init, uninstall, doctor } from '../src/install.js';

async function fixture(t:any){const root=await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-install-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
async function write(root:string,file:string,text:string){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),text);}
test('all adapters idempotent; uninstall restores original bytes',async t=>{
  const root=await fixture(t);const originals:Record<string,string>={
    '.codex/config.toml':'# original\nmodel = "user-choice"\n',
    '.mcp.json':'{\n  "mcpServers": {"existing": {"command": "user-server"}}\n}\n',
    '.cursor/mcp.json':'{ "mcpServers": {}, "userField": true }\n',
    '.claude/settings.json':'{ "hooks": {"UserPromptSubmit": [{"hooks":[{"type":"command","command":"user-hook"}]}]}}\n'};
  for(const [file,value]of Object.entries(originals))await write(root,file,value);
  await init(root,['codex','claude','cursor'],true);
  const installed=await fs.readFile(path.join(root,'.claude/settings.json'),'utf8');assert.ok(installed.includes('user-hook'));
  await init(root,['codex','claude','cursor'],true);assert.equal(await fs.readFile(path.join(root,'.claude/settings.json'),'utf8'),installed);
  assert.ok((await doctor(root)).checks.every(c=>c.ok));
  const result=await uninstall(root);assert.deepEqual(result.preserved,[]);
  for(const[file,value]of Object.entries(originals))assert.equal(await fs.readFile(path.join(root,file),'utf8'),value);
  await assert.rejects(fs.stat(path.join(root,'.cursor/rules/driftbrief.mdc')));
});
test('malformed config leaves integrations and runtime untouched',async t=>{
  const root=await fixture(t);await write(root,'.codex/config.toml','# untouched\n');await write(root,'.mcp.json','{bad');
  await assert.rejects(init(root,['codex','claude']));
  assert.equal(await fs.readFile(path.join(root,'.codex/config.toml'),'utf8'),'# untouched\n');
  await assert.rejects(fs.stat(path.join(root,'.driftbrief')));
});
test('uninstall preserves user modifications and removes exact owned values',async t=>{
  const root=await fixture(t);await init(root,['claude','cursor']);
  const file=path.join(root,'.mcp.json');const data=JSON.parse(await fs.readFile(file,'utf8'));data.mcpServers.driftbrief.args.push('--user-change');await fs.writeFile(file,JSON.stringify(data));
  const cursor=path.join(root,'.cursor/mcp.json');const cdata=JSON.parse(await fs.readFile(cursor,'utf8'));cdata.userAdded='keep';await fs.writeFile(cursor,JSON.stringify(cdata));
  const result=await uninstall(root);assert.ok(result.preserved.includes('.mcp.json'));
  assert.ok((await fs.readFile(file,'utf8')).includes('--user-change'));
  const remaining=JSON.parse(await fs.readFile(cursor,'utf8'));assert.equal(remaining.userAdded,'keep');assert.equal(remaining.mcpServers.driftbrief,undefined);
  assert.ok(await fs.stat(path.join(root,'.driftbrief/run.mjs')));
});
test('hooks opt-in; no AGENTS or CLAUDE file written',async t=>{
  const root=await fixture(t);await init(root,['codex','claude','cursor']);
  for(const file of ['AGENTS.md','CLAUDE.md','.codex/hooks.json','.claude/settings.json'])await assert.rejects(fs.stat(path.join(root,file)));
});
test('colliding user MCP names are not overwritten',async t=>{
  const root=await fixture(t);await write(root,'.mcp.json','{"mcpServers":{"driftbrief":{"command":"mine"}}}');
  await assert.rejects(init(root,['claude']));assert.equal(await fs.readFile(path.join(root,'.mcp.json'),'utf8'),'{"mcpServers":{"driftbrief":{"command":"mine"}}}');
});

test('tampered installation manifest cannot target project source',async t=>{
  const root=await fixture(t);await init(root,['claude']);await write(root,'valuable.ts','export const keep=true;');
  const file=path.join(root,'.driftbrief/install.json');const manifest=JSON.parse(await fs.readFile(file,'utf8'));
  manifest.edits.push({file:'valuable.ts',before:null,after:'export const keep=true;',kind:'file'});await fs.writeFile(file,JSON.stringify(manifest));
  await assert.rejects(uninstall(root));assert.equal(await fs.readFile(path.join(root,'valuable.ts'),'utf8'),'export const keep=true;');
});
