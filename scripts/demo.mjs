import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { games } from '../fixtures/games.mjs';
const exec=promisify(execFile),bundle=path.resolve('run.mjs'),base=path.resolve('artifacts','game-demo-'+Date.now()),examples=[];
await fs.mkdir(base,{recursive:true});
for(const game of games){
  const root=path.join(base,game.id);await fs.mkdir(root,{recursive:true});
  await exec('git',['init','-q','-b','main'],{cwd:root,windowsHide:true});
  for(const[file,value]of Object.entries(game.files)){const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,value);}
  const {stdout}=await exec(process.execPath,[bundle,'map',game.query,'--root',root],{windowsHide:true});
  const result=JSON.parse(stdout);
  if(!game.expected.every(([from,to])=>result.links.some(l=>l.from===from&&l.to===to)))throw new Error('Missing demo relationship: '+game.id);
  examples.push({engine:game.id,query:game.query,result});
}
await fs.mkdir('docs/demo',{recursive:true});
await fs.writeFile('docs/demo/game-maps.json',JSON.stringify(examples,null,2));
const data=JSON.stringify(examples).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'"><title>DriftBrief ,  a small map for game agents</title><style>
:root{color-scheme:dark;font:15px/1.6 system-ui;background:#101512;color:#edf1e8}*{box-sizing:border-box}body{margin:0}main{max-width:1100px;padding:42px 24px;margin:auto}header{display:flex;justify-content:space-between;gap:16px;color:#c8e888}h1{font-size:clamp(32px,5vw,60px);line-height:1.1;letter-spacing:-2px;max-width:800px;margin:44px 0 22px}p{color:#acbaa8;max-width:750px}nav{display:flex;flex-wrap:wrap;gap:10px;margin:32px 0}button{font:inherit;background:#1b251e;border:1px solid #40503c;color:#eef4e8;padding:9px 20px;border-radius:7px;cursor:pointer}button[aria-selected=true]{background:#d1ec93;color:#152013}section{border:1px solid #354330;border-radius:12px;padding:24px;margin:20px 0;background:#172019}h2{font-size:19px;margin:0 0 10px}code{overflow-wrap:anywhere;color:#d1ec93}#query{font-size:18px}#metrics{display:flex;gap:28px;flex-wrap:wrap;color:#c0cfb7}.edge{padding:17px 0;border-top:1px solid #34432e}.edge strong{display:block;font:13px/1.8 ui-monospace,monospace;overflow-wrap:anywhere}.edge span{font-size:12px;color:#aaba9e}.arrow{color:#d1ec93;margin:5px 0}.nodes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}.node{background:#101710;border:1px solid #33432c;padding:14px;border-radius:7px;overflow-wrap:anywhere}.node small{display:block;color:#a5b397}.note{font-size:12px}footer{margin-top:32px;color:#8e9e88;font-size:12px}
</style><main><header><b>◈ DriftBrief</b><span>LOCAL · ONE MAP TOOL</span></header><h1>Help AI understand your game<br>before it starts building.</h1><p>A compact, current map of scripts, scenes and assets, so architecture plans and new systems can start from the project already there.</p><nav id="engines"></nav><section><div class="note">AGENT REQUEST</div><code id="query"></code><p id="metrics"></p></section><section><h2>Connections worth following</h2><div id="links"></div></section><section><h2>Read these files next</h2><div class="nodes" id="nodes"></div></section><p class="note">Explore actual map outputs from reproducible game-project fixtures. Each connection points to its source location. Binary asset entries describe their paths.</p><footer>Default map budget: 4,000 UTF-8 bytes, including metadata. Token counts are estimates. Run npm run demo to reproduce. Planning to add Godot next.</footer></main><script>
const examples=${data};
const el=id=>document.getElementById(id);
function show(index){const x=examples[index],m=x.result;for(const[b,i]of Array.from(el('engines').children).map((b,i)=>[b,i]))b.setAttribute('aria-selected',i===index);el('query').textContent='map({ query: '+JSON.stringify(x.query)+' })';el('metrics').textContent=m.bytes+' bytes · ~'+m.estimatedTokens+' estimated tokens · '+m.nodes.length+' selected files';el('links').replaceChildren();for(const l of m.links){const div=document.createElement('div');div.className='edge';for(const text of [l.from,'↓ '+l.relation,l.to]){const s=document.createElement('strong');s.textContent=text;if(text.startsWith('↓'))s.className='arrow';div.append(s);}const why=document.createElement('span');why.textContent='Reference at line '+l.line+(l.via?' · resolved through '+l.via:'');div.append(why);el('links').append(div);}el('nodes').replaceChildren();for(const n of m.nodes){const div=document.createElement('div');div.className='node';const code=document.createElement('code');code.textContent=n.path;const small=document.createElement('small');small.textContent=n.kind+(n.opaque?' · path only':' · source hash checked');div.append(code,small);el('nodes').append(div);}}
examples.forEach((x,i)=>{const b=document.createElement('button');b.textContent=({unity:'Unity',unreal:'Unreal',h5:'HTML5 / Phaser',cocos:'Cocos Creator'})[x.engine];b.onclick=()=>show(i);el('engines').append(b);});show(0);
</script></html>`;
await fs.writeFile('docs/demo/map.html',html);
console.log('Game map demo: docs/demo/map.html; source fixtures: '+base);
