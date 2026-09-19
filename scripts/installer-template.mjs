#!/usr/bin/env node
// Self-contained offline installer. Run from the game project; no npm or editor plugin required.
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
if (![22,24].includes(Number(process.versions.node.split('.')[0]))) throw new Error('Install Node.js 22 or 24 first.');
const tempBase = await fs.realpath(os.tmpdir());
const temp = await fs.mkdtemp(path.join(tempBase,'driftbrief-installer-'));
try {
  const payload = JSON.parse(gunzipSync(Buffer.from('__PAYLOAD__','base64'),{maxOutputLength:24*1024*1024}).toString('utf8'));
  for (const [name, encoded] of Object.entries(payload)) {
    if (!/^(run\.mjs|assets\/[A-Za-z0-9._-]+)$/.test(name)) throw new Error('Invalid installer entry');
    const file = path.join(temp,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,Buffer.from(encoded,'base64'));
  }
  const result = spawnSync(process.execPath,[path.join(temp,'run.mjs'),'init',...process.argv.slice(2)],{cwd:process.cwd(),stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;process.exitCode=result.status ?? 1;
} finally {
  const resolved=await fs.realpath(temp),relative=path.relative(tempBase,resolved);
  if(relative && !relative.startsWith('..') && !path.isAbsolute(relative))await fs.rm(resolved,{recursive:true,force:true,maxRetries:20,retryDelay:50});
}
