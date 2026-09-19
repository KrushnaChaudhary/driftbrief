import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const exec=promisify(execFile),bundle=path.resolve('run.mjs'),root=await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-runtime-'));
const run=async(...args)=>JSON.parse((await exec(process.execPath,[bundle,...args,'--root',root],{windowsHide:true})).stdout);
const measurements={generatedAt:new Date().toISOString(),node:process.version,platform:process.platform,fixture:{files:30},cliSamples:[],hookSamples:[],idle:null,diskBytes:0};
try{
  for(let i=0;i<30;i++)await fs.writeFile(path.join(root,'source'+i+'.ts'),'export function calculateItem'+i+'(x: number) { return x * 2; }\n');
  await run('init','--clients','claude','--hooks');
  for(let i=0;i<5;i++){const started=performance.now();const result=await run('context','calculateItem17');measurements.cliSamples.push({elapsedMs:+(performance.now()-started).toFixed(2),bytes:result.footprint.bytes});}
  for(let i=0;i<5;i++){const started=performance.now();const output=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[bundle,'hook','--root',root,'--client','claude'],{windowsHide:true});let text='';child.stdout.on('data',d=>text+=d);child.on('error',reject);child.on('close',()=>resolve(text));child.stdin.end(JSON.stringify({hook_event_name:'UserPromptSubmit',cwd:root,prompt:'calculateItem17'}));});measurements.hookSamples.push({elapsedMs:+(performance.now()-started).toFixed(2),outputBytes:Buffer.byteLength(output),injected:Boolean(output)});}
  const transport=new StdioClientTransport({command:process.execPath,args:[bundle,'mcp','--root',root],stderr:'pipe'});
  let serverErrors='';transport.stderr.on('data',d=>serverErrors+=d);
  const client=new Client({name:'driftbrief-runtime-measurement',version:'1'});
  await client.connect(transport);
  await client.callTool({name:'context',arguments:{query:'calculateItem17'}});
  const child={pid:transport.pid};
  await new Promise(r=>setTimeout(r,1500));
  if(process.platform==='win32'){
    const snapshot=async()=>JSON.parse((await exec('powershell.exe',['-NoProfile','-Command','Get-Process -Id '+child.pid+' | Select-Object @{Name="CpuMs";Expression={$_.TotalProcessorTime.TotalMilliseconds}},WorkingSet64,PeakWorkingSet64 | ConvertTo-Json -Compress'],{windowsHide:true})).stdout);
    try{const a=await snapshot(),start=performance.now();await new Promise(r=>setTimeout(r,35000));const b=await snapshot();const elapsed=performance.now()-start;measurements.idle={sampleMs:+elapsed.toFixed(1),cpuMs:b.CpuMs-a.CpuMs,percentOfOneCore:+((b.CpuMs-a.CpuMs)/elapsed*100).toFixed(3),rssBytes:b.WorkingSet64,peakRssBytes:b.PeakWorkingSet64};}catch(error){measurements.idle={unavailable:String(error.message).slice(0,500)};}
  }
  if(serverErrors)console.error(serverErrors);
  await client.callTool({name:'context',arguments:{query:'calculateItem17'}});
  await client.close();
  measurements.serverStderr=serverErrors;
  const size=async(dir)=>{let total=0;for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);total+=item.isDirectory()?await size(file):(await fs.stat(file)).size;}return total;};
  measurements.diskBytes=await size(path.join(root,'.driftbrief','state'));
  measurements.limitations=['Small synthetic fixture on this machine. Not a guarantee for large repositories.','CLI and hook timings include process startup. Hook fallbacks are reported, not counted as successful injections.','The 35-second idle sample includes lock heartbeats and the scheduled 30-second reconciliation. No task-level or provider savings measured.'];
  await fs.mkdir('docs/measurements',{recursive:true});await fs.writeFile('docs/measurements/runtime.json',JSON.stringify(measurements,null,2));
  console.log(JSON.stringify(measurements,null,2));
}finally{await fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50});}
