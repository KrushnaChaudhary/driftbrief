import { promises as fs } from 'node:fs';
import path from 'node:path';
export async function agentCommand(adapter, explicit){
  if(explicit)return /\.[cm]?js$/.test(explicit)?{command:process.execPath,prefix:[path.resolve(explicit)]}:{command:explicit,prefix:[]};
  if(process.platform!=='win32'||adapter!=='claude')return{command:adapter,prefix:[]};
  for(const dir of (process.env.PATH??'').split(path.delimiter)){const file=path.join(dir,'claude.exe');try{await fs.access(file);return{command:file,prefix:[]};}catch{}}
  const pkgRoot=path.join(process.env.APPDATA??'','npm/node_modules/@anthropic-ai/claude-code');
  try{
    const meta=JSON.parse(await fs.readFile(path.join(pkgRoot,'package.json'),'utf8'));
    const target=path.resolve(pkgRoot,typeof meta.bin==='string'?meta.bin:meta.bin.claude);
    await fs.access(target);
    return /\.[cm]?js$/.test(target)?{command:process.execPath,prefix:[target]}:{command:target,prefix:[]};
  }catch{throw new Error('Could not find Claude executable. Supply --agent-bin with the installed executable path.');}
}
