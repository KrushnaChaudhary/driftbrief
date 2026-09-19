import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, chmod } from 'node:fs/promises';
await mkdir('assets',{recursive:true});
const grammars={'web-tree-sitter.wasm':'web-tree-sitter','tree-sitter-javascript.wasm':'tree-sitter-javascript','tree-sitter-python.wasm':'tree-sitter-python','tree-sitter-typescript.wasm':'tree-sitter-typescript','tree-sitter-tsx.wasm':'tree-sitter-typescript'};
for(const[file,pkg]of Object.entries(grammars))await copyFile('node_modules/'+pkg+'/'+file,'assets/'+file);
const result=await build({entryPoints:['src/cli.ts'],outfile:'run.mjs',bundle:true,platform:'node',target:'node22',format:'esm',mainFields:['module','main'],metafile:true,sourcemap:false,banner:{js:'#!/usr/bin/env node\nimport { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);'}});
await chmod('run.mjs',0o755);
const packages=new Set(Object.values(grammars));
for(const file of Object.keys(result.metafile.inputs)){
  const match=file.replaceAll('\\','/').match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if(match)packages.add(match[1]);
}
const notices=[],sbom=[];
for(const pkg of [...packages].sort()){
  try{
    const meta=JSON.parse(await readFile('node_modules/'+pkg+'/package.json','utf8'));
    sbom.push({name:pkg,version:meta.version,license:meta.license??'see upstream'});
    let found=false;
    for(const file of ['LICENSE','LICENSE.md','LICENSE.txt','license','license.md','LICENSE-MIT.txt']){
      try{notices.push(pkg+'@'+meta.version+'\n'+await readFile('node_modules/'+pkg+'/'+file,'utf8'));found=true;break;}catch{}
    }
    if(!found)notices.push(pkg+'@'+meta.version+'\nDeclared license: '+JSON.stringify(meta.license??'see upstream')+'\nSource: https://www.npmjs.com/package/'+pkg);
  }catch{}
}
await writeFile('assets/THIRD_PARTY_NOTICES.txt',notices.join('\n\n'));
await writeFile('assets/dependencies.json',JSON.stringify({format:'driftbrief-bundled-components-v1',components:sbom},null,2));
console.log('Built run.mjs, parser assets, dependency inventory and license notices.');
