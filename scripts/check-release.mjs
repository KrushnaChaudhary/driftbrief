import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile),pkg=JSON.parse(await fs.readFile('package.json','utf8'));
assert.equal(pkg.dependencies,undefined,'Distribution must not require runtime npm dependencies');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-portable-'));
try{
  const files=unzipSync(await fs.readFile('release/driftbrief-'+pkg.version+'-portable.zip'));
  for(const[name,bytes]of Object.entries(files)){assert.ok(name.startsWith('.driftbrief/')&&!name.includes('..'));const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
  await fs.writeFile(path.join(root,'example.py'),'def portable_sample():\n    return 42\n');
  const run=async(...args)=>JSON.parse((await exec(process.execPath,[path.join(root,'.driftbrief/run.mjs'),...args,'--root',root],{windowsHide:true})).stdout);
  await run('init','--clients','codex,claude,cursor');
  assert.ok((await run('doctor')).checks.every(c=>c.ok));
  assert.ok((await run('map','portable_sample')).nodes.some(e=>e.path==='example.py'));
  const removal=await run('uninstall');assert.deepEqual(removal.preserved,[]);
  console.log('Extracted portable ZIP passes initialization, WASM-backed retrieval, doctor and clean integration removal without node_modules.');
}finally{await fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50});}
