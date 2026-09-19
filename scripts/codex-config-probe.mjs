import { spawn } from 'node:child_process';
import readline from 'node:readline';
export async function codexConfigProbe(root) {
  const proc=spawn('codex',['app-server','--stdio','-c','projects.'+JSON.stringify(root)+'.trust_level="trusted"'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
  const lines=readline.createInterface({input:proc.stdout});
  proc.stderr.resume();
  return await new Promise(resolve=>{
    const finish=value=>{clearTimeout(timer);lines.close();proc.stdin.end();proc.kill();resolve(value);};
    const timer=setTimeout(()=>finish({status:'timeout'}),12000);
    proc.on('error',()=>finish({status:'unavailable'}));
    const send=message=>proc.stdin.write(JSON.stringify(message)+'\n');
    lines.on('line',line=>{let msg;try{msg=JSON.parse(line)}catch{return}
      if(msg.id===0){if(msg.error){finish({status:'initialize-error',error:msg.error.message});return;}send({method:'initialized',params:{}});send({id:1,method:'config/read',params:{cwd:root,includeLayers:false}});}
      if(msg.id===1){if(msg.error)finish({status:'config-error',error:msg.error.message});else finish({status:msg.result?.config?.mcp_servers?.driftbrief?'project-entry-loaded':'project-entry-not-loaded',driftbrief:msg.result?.config?.mcp_servers?.driftbrief??null,scope:'Read-only app-server config resolution; no thread, turn, or model call.'});}
    });
    send({id:0,method:'initialize',params:{clientInfo:{name:'driftbrief_config_probe',title:'DriftBrief configuration probe',version:'0.1.0'}}});
  });
}
