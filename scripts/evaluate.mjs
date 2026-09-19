import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { tasks } from '../evals/tasks.mjs';
import { agentCommand } from './agent-command.mjs';
const exec=promisify(execFile),argv=process.argv.slice(2);
const value=(key,fallback)=>{const at=argv.indexOf('--'+key);return at<0?fallback:argv[at+1];};
const adapter=value('adapter','codex'),model=value('model',null),effort=value('effort','medium'),repeats=Number(value('repeats','3'));
if(!['codex','claude'].includes(adapter)||!Number.isInteger(repeats)||repeats<1||repeats>10)throw new Error('Choose adapter codex/claude and repeats 1–10.');
const jobs=[];for(let repeat=0;repeat<repeats;repeat++)for(const task of tasks)for(const arm of repeat%2?['driftbrief','baseline']:['baseline','driftbrief'])jobs.push({repeat,task:task.id,arm});
if(argv.includes('--dry-run')||!argv.includes('--allow-agent-usage')){
  console.log(JSON.stringify({dryRun:true,adapter,model,effort,runs:jobs.length,jobs,notice:'No model calls. --allow-agent-usage and an explicit model are required to execute.'},null,2));
}else{
  if(!model)throw new Error('Specify --model; model selection is never guessed.');
  const base=path.resolve('artifacts','eval-'+Date.now());await fs.mkdir(base,{recursive:true});
  const bundle=path.resolve('run.mjs'),samples=[];
  const resolved=await agentCommand(adapter,value('agent-bin',null));
  const executable=resolved.command,leading=resolved.prefix;
  let version='unavailable';try{version=(await exec(executable,[...leading,'--version'],{windowsHide:true})).stdout.trim();}catch{}
  for(const job of jobs){
    const task=tasks.find(t=>t.id===job.task),root=path.join(base,job.task+'-'+job.repeat+'-'+job.arm);await fs.mkdir(path.join(root,'src'),{recursive:true});
    await exec('git',['init','-q','-b','main'],{cwd:root,windowsHide:true});
    const file='src/logic.'+(task.language==='js'?'mjs':'py');await fs.writeFile(path.join(root,file),task.source);
    for(let i=0;i<20;i++)await fs.writeFile(path.join(root,'src','unrelated'+i+(task.language==='js'?'.mjs':'.py')),task.language==='js'?'export const irrelevant'+i+' = '+i+';':'irrelevant_'+i+' = '+i+'\n');
    const mcp={mcpServers:job.arm==='driftbrief'?{driftbrief:{command:process.execPath,args:[bundle,'mcp','--root',root]}}:{}};
    let args;
    if(adapter==='codex'){
      args=['exec','--json','--ephemeral','--ignore-user-config','--sandbox','workspace-write','--model',model,'-c','model_reasoning_effort='+JSON.stringify(effort),'-C',root];
      if(job.arm==='driftbrief')args.push('-c','mcp_servers.driftbrief.command='+JSON.stringify(process.execPath),'-c','mcp_servers.driftbrief.args='+JSON.stringify([bundle,'mcp','--root',root]));
      args.push(task.prompt);
    }else{
      const config=path.join(root,'eval-mcp.json');await fs.writeFile(config,JSON.stringify(mcp));
      args=[...leading,'-p','--output-format','json','--no-session-persistence','--setting-sources','project,local','--strict-mcp-config','--mcp-config',config,'--model',model,'--effort',effort,task.prompt];
    }
    const start=performance.now();let stdout='',stderr='',exitCode=0;
    try{const result=await exec(executable,args,{cwd:root,windowsHide:true,timeout:120000,maxBuffer:16*1024*1024});stdout=result.stdout;stderr=result.stderr;}catch(error){stdout=error.stdout??'';stderr=error.stderr??String(error);exitCode=typeof error.code==='number'?error.code:-1;}
    const elapsedMs=performance.now()-start;await fs.writeFile(path.join(root,'agent-output.jsonl'),stdout);await fs.writeFile(path.join(root,'agent-stderr.txt'),stderr);
    let usage=null,answer='',treatmentObserved=null;
    try{
      if(adapter==='codex'){const events=stdout.split('\n').filter(Boolean).flatMap(line=>{try{return[JSON.parse(line)]}catch{return[]}});usage=events.findLast(e=>e.type==='turn.completed')?.usage??null;answer=events.filter(e=>e.item?.type==='agent_message').map(e=>e.item.text).join('\n');treatmentObserved=events.some(e=>e.item?.server==='driftbrief'||e.item?.server_name==='driftbrief');}
      else{const result=JSON.parse(stdout);usage=result.usage??null;answer=result.result??'';}
    }catch{}
    let passed=false;
    if(exitCode===0)try{
      if(task.verify===null)passed=answer.trim()==='hello'&&(await fs.readFile(path.join(root,file),'utf8'))===task.source;
      else if(task.language==='js'){await exec(process.execPath,['--input-type=module','-e','import assert from "node:assert/strict";import * as m from '+JSON.stringify(pathToFileURL(path.join(root,file)).href)+';'+task.verify],{cwd:root,windowsHide:true,timeout:10000});passed=true;}
      else{await exec('python',['-c','import importlib.util\nspec=importlib.util.spec_from_file_location("m","src/logic.py")\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\n'+task.verify],{cwd:root,windowsHide:true,timeout:10000});passed=true;}
    }catch{}
    samples.push({...job,exitCode,elapsedMs,passed,usage,treatmentObserved});
    await fs.writeFile(path.join(base,'results.json'),JSON.stringify({adapter,version,model,effort,repeats,samples,limitations:['Synthetic pilot; not universal effectiveness evidence.','Claude tool activation requires manual trace inspection; missing usage remains null.','No automatic hook treatment in this runner.']},null,2));
    console.log(job.task,job.arm,passed?'PASS':'FAIL',Math.round(elapsedMs)+'ms');
  }
  console.log('Results: '+path.join(base,'results.json'));
}
