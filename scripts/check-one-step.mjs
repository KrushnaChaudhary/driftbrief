import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
const exec=promisify(execFile),installer=path.resolve('release/driftbrief-install.mjs');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-one-step Ω '));
try {
  await fs.mkdir(path.join(root,'Assets/Scripts'),{recursive:true});
  const source='public class PlayerMovement : MonoBehaviour {}';
  await fs.writeFile(path.join(root,'Assets/Scripts/PlayerMovement.cs'),source);
  await exec(process.execPath,[installer],{cwd:root,windowsHide:true});
  await exec(process.execPath,[installer],{cwd:root,windowsHide:true});
  const run=async(...args)=>JSON.parse((await exec(process.execPath,[path.join(root,'.driftbrief/run.mjs'),...args],{cwd:root,windowsHide:true})).stdout);
  assert.ok((await run('doctor')).checks.every(c=>c.ok));
  assert.ok((await run('map','PlayerMovement')).nodes.some(n=>n.path==='Assets/Scripts/PlayerMovement.cs'));
  assert.equal(await fs.readFile(path.join(root,'Assets/Scripts/PlayerMovement.cs'),'utf8'),source);
  await assert.rejects(fs.stat(path.join(root,'package.json')));
  await assert.rejects(fs.stat(path.join(root,'node_modules')));
  assert.deepEqual((await run('uninstall')).preserved,[]);
  console.log('Single-command offline installer passes twice, all adapter checks, game map retrieval, source preservation and clean removal; no project npm dependencies.');
} finally {await fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50});}
