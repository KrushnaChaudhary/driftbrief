import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { agentCommand } from './agent-command.mjs';
import { codexConfigProbe } from './codex-config-probe.mjs';
const exec=promisify(execFile),root=await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-native-discovery-')),bundle=path.resolve('run.mjs');
const result={generatedAt:new Date().toISOString(),codex:null,claude:null,cursor:{status:'not-exercised',reason:'No native Cursor session available in this verification run.'}};
const capture=async(command,args)=>{try{const r=await exec(command,args,{cwd:root,windowsHide:true,timeout:15000,maxBuffer:128000});return{exitCode:0,stdout:r.stdout,stderr:r.stderr};}catch(e){return{exitCode:typeof e.code==='number'?e.code:-1,stdout:e.stdout??'',stderr:e.stderr??String(e)}}};
try{
  await exec('git',['init','-q','-b','main'],{cwd:root,windowsHide:true});
  await exec(process.execPath,[bundle,'init','--clients','codex,claude','--root',root],{windowsHide:true});
  const canonicalRoot=await fs.realpath(root);
  result.codex={version:await capture('codex',['--version']),untrustedDiscovery:await capture('codex',['-C',root,'mcp','get','driftbrief','--json']),trustedFixtureDiscovery:await capture('codex',['-C',root,'-c','projects.'+JSON.stringify(canonicalRoot)+'.trust_level="trusted"','mcp','get','driftbrief','--json']),scope:'Native configuration discovery only. Temporary command-line trust applies only to this generated test fixture, not user configuration; no agent invocation.'};
  result.codex.appServerConfig=await codexConfigProbe(canonicalRoot);
  result.codex.scopedLauncherDiscovery=await capture(process.execPath,[bundle,'launch','codex','--root',root,'--','mcp','get','driftbrief','--json']);
  const claude=await agentCommand('claude');
  result.claude={version:await capture(claude.command,[...claude.prefix,'--version']),discovery:await capture(claude.command,[...claude.prefix,'mcp','get','driftbrief']),scope:'Native discovery/approval status; no trust bypass or model calls.'};
  await exec(process.execPath,[bundle,'uninstall','--root',root],{windowsHide:true});
  if(result.codex.scopedLauncherDiscovery?.stdout){try{result.codex.scopedLauncherDiscovery.parsed=JSON.parse(result.codex.scopedLauncherDiscovery.stdout);delete result.codex.scopedLauncherDiscovery.stdout;}catch{}}
  await fs.mkdir('docs/measurements',{recursive:true});
  // Remove machine-specific paths from the published diagnostic record.
  let json=JSON.stringify(result,null,2);
  json=json.split(JSON.stringify(bundle).slice(1,-1)).join('<driftbrief-runtime>');
  json=json.split(JSON.stringify(root).slice(1,-1)).join('<temporary-project>').split(JSON.stringify(process.execPath).slice(1,-1)).join('<node-executable>');
  json=json.split(JSON.stringify(await fs.realpath(root)).slice(1,-1)).join('<temporary-project>');
  if(process.env.USERPROFILE)json=json.split(JSON.stringify(process.env.USERPROFILE).slice(1,-1)).join('<user-profile>');
  await fs.writeFile('docs/measurements/client-discovery.json',json);
  console.log(json);
}finally{await fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50});}
