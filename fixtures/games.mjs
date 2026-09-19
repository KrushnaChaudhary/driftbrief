export const games = [
  { id:'unity', query:'PlayerMovement', expected:[['Assets/Prefabs/Player.prefab','Assets/Scripts/PlayerMovement.cs'],['Assets/Scenes/Arena.unity','Assets/Prefabs/Player.prefab']], files:{
    'ProjectSettings/ProjectVersion.txt':'m_EditorVersion: 6000.0.0f1',
    'Packages/manifest.json':JSON.stringify({dependencies:{'com.unity.inputsystem':'1.11.2'}}),
    'Assets/Scripts/PlayerMovement.cs':'using UnityEngine;\npublic class PlayerMovement : MonoBehaviour { public float speed = 6; }',
    'Assets/Scripts/PlayerMovement.cs.meta':'fileFormatVersion: 2\nguid: '+ 'a'.repeat(32),
    'Assets/Prefabs/Player.prefab':'%YAML 1.1\nMonoBehaviour:\n  m_Name: Player\n  m_Script: {fileID: 11500000, guid: '+ 'a'.repeat(32)+', type: 3}',
    'Assets/Prefabs/Player.prefab.meta':'fileFormatVersion: 2\nguid: '+ 'b'.repeat(32),
    'Assets/Scenes/Arena.unity':'%YAML 1.1\nPrefabInstance:\n  m_SourcePrefab: {fileID: 100100000, guid: '+ 'b'.repeat(32)+', type: 3}'
  }},
  { id:'unreal', query:'Arena',expected:[['Config/DefaultEngine.ini','Content/Maps/Arena.umap']],files:{
    'Shooter.uproject':JSON.stringify({EngineAssociation:'5.8',Modules:[{Name:'Shooter'}]}),
    'Source/Shooter/Shooter.Build.cs':'public class Shooter : ModuleRules { PublicDependencyModuleNames.AddRange(new string[] {"Core", "Engine"}); }',
    'Source/Shooter/Hero.h':'UCLASS()\nclass SHOOTER_API AHero : public ACharacter {};',
    'Source/Shooter/Hero.cpp':'#include "Hero.h"\nvoid AHero::BeginPlay() {}',
    'Config/DefaultEngine.ini':'[/Script/EngineSettings.GameMapsSettings]\nGameDefaultMap=/Game/Maps/Arena.Arena',
    'Content/Maps/Arena.umap':new Uint8Array([0,1,2,3])
  }},
  { id:'h5',query:'Boot',expected:[['src/main.ts','src/Boot.ts'],['src/Boot.ts','src/Play.ts'],['src/Boot.ts','public/assets/player.png']],files:{
    'package.json':JSON.stringify({dependencies:{phaser:'3.90.0'}}),
    'src/main.ts':'import { Boot } from "./Boot.js";\nnew Phaser.Game({scene:[Boot]});',
    'src/Boot.ts':'export class Boot extends Phaser.Scene { constructor(){ super("Boot"); } preload(){ this.load.image("player", "assets/player.png"); } create(){ this.scene.start("Play"); } }',
    'src/Play.ts':'export class Play extends Phaser.Scene { constructor(){ super({ key: "Play" }); } }',
    'public/assets/player.png':new Uint8Array([0,137,80,78,71])
  }},
  { id:'cocos',query:'Menu',expected:[['assets/Menu.scene','assets/Button.prefab']],files:{
    'assets/Menu.scene':JSON.stringify([{__type__:'cc.SceneAsset',_name:'Menu',prefab:{__uuid__:'911560ae-98b2-4f4f-862f-36b7499f7ce3'}}]),
    'assets/Button.prefab':JSON.stringify([{__type__:'cc.Prefab',_name:'Button'}]),
    'assets/Button.prefab.meta':JSON.stringify({uuid:'911560ae-98b2-4f4f-862f-36b7499f7ce3',ver:'1.0.0'})
  }}
];
