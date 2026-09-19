import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { games } from '../fixtures/games.mjs';
const exec=promisify(execFile),bundle=path.resolve('run.mjs');
const report={generatedAt:new Date().toISOString(),node:process.version,platform:process.platform,samples:[],agentTokens:null,agentTaskSuccess:null,limitations:['Synthetic source-format fixtures, not engine-built games.','Fresh process time includes Node startup. No model calls or task-level savings measured.','Expected relationships are declared independently of the map implementation.']};
for(const game of games){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-game-'+game.id+'-'));
  try{
    for(const[file,value]of Object.entries(game.files)){const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,value);}
    for(let i=0;i<80;i++){const dir=game.id==='unity'?'Assets/Other':game.id==='unreal'?'Source/Other':'src/other';await fs.mkdir(path.join(root,dir),{recursive:true});await fs.writeFile(path.join(root,dir,'Unrelated'+i+'.ts'),'export class Unrelated'+i+' {}');}
    for(let repeat=0;repeat<3;repeat++){
      const start=performance.now(),{stdout}=await exec(process.execPath,[bundle,'map',game.query,'--root',root],{windowsHide:true});
      const map=JSON.parse(stdout),expected=game.expected.map(([from,to])=>({from,to,found:map.links.some(l=>l.from===from&&l.to===to)}));
      report.samples.push({engine:game.id,repeat,files:Object.keys(game.files).length+80,elapsedMs:+(performance.now()-start).toFixed(2),bytes:map.bytes,estimatedTokens:map.estimatedTokens,expected,pass:expected.every(e=>e.found)});
    }
  }finally{await fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50});}
}
report.passed=report.samples.filter(s=>s.pass).length;report.total=report.samples.length;
await fs.mkdir('docs/measurements',{recursive:true});await fs.writeFile('docs/measurements/game-map.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,total:report.total,samples:report.samples.map(({engine,elapsedMs,bytes,pass})=>({engine,elapsedMs,bytes,pass}))},null,2));
if(report.passed!==report.total)process.exitCode=1;
