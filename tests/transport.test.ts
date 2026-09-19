import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { init } from '../src/install.js';
import { hash } from '../src/fs.js';
const bundle=path.resolve('run.mjs');
async function fixture(t:any){const root=await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-mcp-'));t.after(()=>fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50}));return root;}
test('official MCP client discovers, invokes, and sees source updates',async t=>{
  const root=await fixture(t);await fs.writeFile(path.join(root,'auth.ts'),'function authenticate(){return "before";}');
  const transport=new StdioClientTransport({command:process.execPath,args:[bundle,'mcp','--root',root],stderr:'pipe'});
  const client=new Client({name:'driftbrief-contract-test',version:'1'});
  await client.connect(transport);
  try {
    assert.deepEqual((await client.listTools()).tools.map(t=>t.name),['map']);
    const first=await client.callTool({name:'map',arguments:{query:'authenticate'}});const brief=JSON.parse((first.content as any)[0].text);assert.equal(brief.verified[0].sha256,hash('function authenticate(){return "before";}'));
    await new Promise(resolve => setTimeout(resolve, 2500));
    await fs.writeFile(path.join(root,'auth.ts'),'function authenticate(){return "after";}');
    const second=await client.callTool({name:'map',arguments:{query:'authenticate'}});assert.equal(JSON.parse((second.content as any)[0].text).verified[0].sha256,hash('function authenticate(){return "after";}'));
  }finally{await client.close();}
});
test('MCP EOF during indexing terminates within bounded cleanup',async t=>{
  const root=await fixture(t);for(let i=0;i<100;i++)await fs.writeFile(path.join(root,'file'+i+'.ts'),'function needle(){return 1;}\n'.repeat(200));
  const child=spawn(process.execPath,[bundle,'mcp','--root',root],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const exit=new Promise<number|null>(resolve=>child.once('exit',resolve));
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}}})+'\n');
  await new Promise(resolve=>setTimeout(resolve,150));child.stdin.end();
  const timeout=setTimeout(()=>child.kill(),4000);
  try{assert.equal(await exit,0);}finally{clearTimeout(timeout);}
});
test('hook contract bounded; malformed input and changed source fail open',async t=>{
  const root=await fixture(t);await fs.writeFile(path.join(root,'auth.ts'),'function authenticate(){return true;}');await init(root,['claude'],true);
  const invoke=(input:string)=>new Promise<{out:string;code:number|null}>(resolve=>{const child=spawn(process.execPath,[bundle,'hook','--root',root,'--client','claude'],{windowsHide:true});let out='';child.stdout.on('data',d=>out+=d);child.on('exit',code=>resolve({out,code}));child.stdin.end(input);});
  const valid=await invoke(JSON.stringify({hook_event_name:'UserPromptSubmit',cwd:root,prompt:'authenticate'}));assert.equal(valid.code,0);assert.ok(Buffer.byteLength(valid.out)<=4001);
  if(valid.out)assert.equal(JSON.parse(valid.out).hookSpecificOutput.hookEventName,'UserPromptSubmit');
  assert.deepEqual(await invoke('{bad'),{out:'',code:0});
  await fs.writeFile(path.join(root,'auth.ts'),'function authenticate(){return false;}');assert.equal((await invoke(JSON.stringify({hook_event_name:'UserPromptSubmit',cwd:root,prompt:'authenticate'}))).out,'');
});

test('two MCP hosts remain usable when one refresh owner exits',async t=>{
  const root=await fixture(t);await fs.writeFile(path.join(root,'shared.ts'),'function sharedSource(){return 1;}');
  const clients=[] as Client[];
  try{
    for(let i=0;i<2;i++){const transport=new StdioClientTransport({command:process.execPath,args:[bundle,'mcp','--root',root],stderr:'pipe'});transport.stderr?.on('data', () => {});const client=new Client({name:'two-host-'+i,version:'1'});await client.connect(transport);clients.push(client);}
    await Promise.all(clients.map(client=>client.callTool({name:'map',arguments:{query:'sharedSource'}})));
    await new Promise(resolve=>setTimeout(resolve,2500));await clients[0].close();
    await fs.writeFile(path.join(root,'shared.ts'),'function sharedSource(){return 2;}');
    const result=await clients[1].callTool({name:'map',arguments:{query:'sharedSource'}});assert.equal(JSON.parse((result.content as any)[0].text).verified[0].sha256,hash('function sharedSource(){return 2;}'));
  }finally{await Promise.all(clients.map(client=>client.close()));}
});
