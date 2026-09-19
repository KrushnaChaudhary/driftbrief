import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { projectMap, encodeMap } from '../src/map.js';
import { gameInfo } from '../src/games.js';
import { hash } from '../src/fs.js';
import { reconcile } from '../src/state.js';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'driftbrief-games Ω '));
  t.after(() => fs.rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:50}));
  const write = async(file:string,text:string|Buffer) => {await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),text);};
  return {root,write};
}
const scriptGuid = 'a'.repeat(32), prefabGuid = 'b'.repeat(32);
async function unity(t:any) {
  const f = await fixture(t);
  await f.write('ProjectSettings/ProjectVersion.txt','m_EditorVersion: 6000.0.0f1');
  await f.write('Assets/Scripts/PlayerMovement.cs','using UnityEngine;\npublic class PlayerMovement : MonoBehaviour { }');
  await f.write('Assets/Scripts/PlayerMovement.cs.meta','fileFormatVersion: 2\nguid: '+scriptGuid);
  await f.write('Assets/Prefabs/Player.prefab','%YAML 1.1\nMonoBehaviour:\n  m_Script: {fileID: 11500000, guid: '+scriptGuid+', type: 3}\n  m_Name: Player');
  await f.write('Assets/Prefabs/Player.prefab.meta','fileFormatVersion: 2\nguid: '+prefabGuid);
  await f.write('Assets/Scenes/Arena.unity','%YAML 1.1\nPrefabInstance:\n  m_SourcePrefab: {fileID: 100100000, guid: '+prefabGuid+', type: 3}');
  return f;
}
test('Unity map connects scene, prefab and C# through actual metadata',async t=>{
  const {root}=await unity(t);const map=await projectMap(root,{query:'PlayerMovement'});
  assert.deepEqual(map.engines,['unity']);
  assert.ok(map.links.some(l=>l.from==='Assets/Prefabs/Player.prefab' && l.to==='Assets/Scripts/PlayerMovement.cs'));
  assert.ok(map.links.some(l=>l.from==='Assets/Scenes/Arena.unity' && l.to==='Assets/Prefabs/Player.prefab'));
  assert.ok(map.verified.some(v=>v.path==='Assets/Scripts/PlayerMovement.cs.meta'));
  assert.ok(map.bytes<=4000);
});
test('map detects newly wired references without watcher events, and prunes deletions',async t=>{
  const {root,write}=await unity(t);await projectMap(root);
  await write('Assets/Scripts/CameraFollow.cs','public class CameraFollow : MonoBehaviour {}');
  await write('Assets/Scripts/CameraFollow.cs.meta','guid: '+'c'.repeat(32));
  await write('Assets/Prefabs/Player.prefab','%YAML 1.1\nm_Script: {guid: '+'c'.repeat(32)+'}');
  const map=await projectMap(root,{query:'CameraFollow'});
  assert.ok(map.links.some(l=>l.to==='Assets/Scripts/CameraFollow.cs'));
  assert.ok(!map.links.some(l=>l.to==='Assets/Scripts/PlayerMovement.cs'));
  await fs.unlink(path.join(root,'Assets/Scripts/CameraFollow.cs'));
  assert.ok(!(await projectMap(root,{query:'CameraFollow'})).nodes.some(n=>n.path.endsWith('CameraFollow.cs')));
});
test('changed metadata between selection and delivery never verifies an obsolete link',async t=>{
  const {root,write}=await unity(t);
  const map=await projectMap(root,{query:'PlayerMovement',afterRank:()=>write('Assets/Scripts/PlayerMovement.cs.meta','guid: '+'f'.repeat(32))});
  assert.ok(!map.links.some(l=>l.to==='Assets/Scripts/PlayerMovement.cs'));
  assert.ok(map.omissions['changed-during-request']>0);
});
test('duplicate Unity GUIDs are unresolved, never guessed',async t=>{
  const {root,write}=await unity(t);
  await write('Assets/Scripts/Other.cs','class Other {}');await write('Assets/Scripts/Other.cs.meta','guid: '+scriptGuid);
  const map=await projectMap(root,{query:'Player'});
  assert.ok(!map.links.some(l=>l.from.endsWith('Player.prefab')));
  assert.ok(map.omissions['unresolved-or-external-references']>0);
});
test('Unreal map includes declared modules, headers, default level and opaque assets',async t=>{
  const {root,write}=await fixture(t);
  await write('Shooter.uproject',JSON.stringify({EngineAssociation:'5.8',Modules:[{Name:'Shooter'}]}));
  await write('Source/Shooter/Shooter.Build.cs','public class Shooter : ModuleRules { PublicDependencyModuleNames.AddRange(new string[] { "Core", "Engine" }); }');
  await write('Source/Shooter/Hero.h','UCLASS()\nclass SHOOTER_API AHero : public ACharacter {};');
  await write('Source/Shooter/Hero.cpp','#include "Hero.h"\nvoid AHero::BeginPlay() {}');
  await write('Config/DefaultEngine.ini','[/Script/EngineSettings.GameMapsSettings]\nGameDefaultMap=/Game/Maps/Arena.Arena');
  await write('Content/Maps/Arena.umap',Buffer.from([0,1,2,3]));
  const overview=await projectMap(root,{maxBytes:12000});
  assert.ok(overview.engines.includes('unreal'));
  assert.ok(overview.links.some(l=>l.from==='Shooter.uproject' && l.to.endsWith('Shooter.Build.cs')));
  const map=await projectMap(root,{query:'Arena'});
  assert.ok(map.links.some(l=>l.from==='Config/DefaultEngine.ini' && l.to==='Content/Maps/Arena.umap'));
  assert.ok(map.nodes.some(n=>n.path.endsWith('.umap') && n.opaque));
  assert.ok(!map.verified.some(v=>v.path.endsWith('.umap')));
  assert.ok((await projectMap(root,{query:'Hero'})).links.some(l=>l.relation==='include-candidate'));
});
test('HTML5 maps imports, Phaser scene transitions and literal asset loads',async t=>{
  const {root,write}=await fixture(t);
  await write('package.json',JSON.stringify({dependencies:{phaser:'3.90.0'}}));
  await write('src/main.ts','import { Boot } from "./Boot.js";\nnew Phaser.Game({ scene: [Boot] });');
  await write('src/Boot.ts','export class Boot extends Phaser.Scene { constructor(){super("Boot");} preload(){this.load.image("player","assets/player.png");} create(){this.scene.start("Play");} }');
  await write('src/Play.ts','export class Play extends Phaser.Scene { constructor(){super({key:"Play"});} }');
  await write('public/assets/player.png',Buffer.from([0,137,80,78,71]));
  const map=await projectMap(root,{query:'Boot',maxBytes:12000});
  assert.ok(map.engines.includes('h5'));
  assert.ok(map.links.some(l=>l.from==='src/main.ts' && l.to==='src/Boot.ts'));
  assert.ok(map.links.some(l=>l.to==='src/Play.ts' && l.relation==='scene-transition-candidate'));
  assert.ok(map.links.some(l=>l.to==='public/assets/player.png'));
});
test('game build caches, credentials and opaque symlink escapes never enter map',async t=>{
  const {root,write}=await fixture(t);
  for (const dir of ['Library','Temp','Logs','Binaries','Intermediate','Saved','DerivedDataCache']) await write(dir+'/Player.cs','class Player {}');
  await write('Assets/.env','secret=anything');await write('Assets/secret.ts','const password = "private-credential-12345";');
  await write('Assets/Good.cs','class Good {}');
  const snapshot=await reconcile(root);
  assert.deepEqual(snapshot.documents.map(d=>d.path),['Assets/Good.cs']);
  const other=await fixture(t);await other.write('outside.png',Buffer.from([0,1]));
  try {await fs.symlink(other.root,path.join(root,'Assets/External'),process.platform==='win32'?'junction':'dir');}
  catch(e:any){if(e.code==='EPERM')return;throw e;}
  assert.equal((await projectMap(root)).coverage.assets,0);
});
test('game adapter ignores commented imports and fake declarations in strings',()=>{
  const js=gameInfo('src/Game.ts','// import Fake from "./Fake"\nconst text = "class Invented {}";\nclass Game extends Phaser.Scene {}');
  assert.ok(!js.refs.some(r=>r.target==='./Fake'));assert.ok(!js.labels.includes('Invented'));
  const cs=gameInfo('Assets/Game.cs','/* class Wrong : Bad {} */ public class Game : MonoBehaviour {}');
  assert.deepEqual(cs.labels,['Game']);
});
test('map bounds include verification, links and metadata; irrelevant query adds no source',async t=>{
  const {root}=await unity(t);
  for(const budget of [1500,2000,4000,12000]){
    const map=await projectMap(root,{query:'Player',maxBytes:budget});const encoded=encodeMap(map,budget);
    assert.ok(Buffer.byteLength(encoded)<=budget);assert.equal(Buffer.byteLength(encoded),map.bytes);
    const nodes=new Set(map.nodes.map(n=>n.path));assert.ok(map.links.every(l=>nodes.has(l.from)&&nodes.has(l.to)));
  }
  assert.equal((await projectMap(root,{query:'thanks hello'})).nodes.length,0);
});
test('map does not retain task queries or accumulating evidence receipts',async t=>{
  const {root,write}=await fixture(t);await write('src/Game.ts','export class Game {}');
  const map=await projectMap(root,{query:'Game private-prompt-phrase'});
  assert.equal(map.verified[0].sha256,hash('export class Game {}'));
  await assert.rejects(fs.stat(path.join(root,'.driftbrief/state/receipts')));
  const walk=async(dir:string):Promise<string[]>=>{const out:string[]=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await walk(p));else out.push(await fs.readFile(p,'utf8'));}return out;};
  assert.ok(!(await walk(path.join(root,'.driftbrief/state'))).join('').includes('private-prompt-phrase'));
});

test('Cocos JSON metadata resolves exact scene/prefab UUIDs',async t=>{
  const {root,write}=await fixture(t);const uuid='911560ae-98b2-4f4f-862f-36b7499f7ce3';
  await write('assets/Menu.scene',JSON.stringify([{__type__:'cc.SceneAsset',_name:'Menu',prefab:{__uuid__:uuid}}]));
  await write('assets/Button.prefab',JSON.stringify([{__type__:'cc.Prefab',_name:'Button'}]));
  await write('assets/Button.prefab.meta',JSON.stringify({uuid}));
  const map=await projectMap(root,{query:'Menu'});
  assert.deepEqual(map.engines,['h5']);
  assert.ok(map.links.some(l=>l.from==='assets/Menu.scene'&&l.to==='assets/Button.prefab'));
});
