import path from 'node:path';

export interface GameRef { kind: 'guid' | 'import' | 'include' | 'asset-path' | 'symbol' | 'scene-key' | 'module'; target: string; line: number }
export interface GameInfo { kind: string; engine?: string; labels: string[]; refs: GameRef[]; guid?: string; partial?: boolean }
const posix = path.posix;

// A bounded lexical adapter, not a compiler or an execution/call graph.
function withoutComments(text: string): string {
  return text.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/g,
    (all, literal) => literal ?? all.replace(/[^\r\n]/g, ' '));
}
export function gameInfo(file: string, text: string): GameInfo {
  const ext = posix.extname(file).toLowerCase();
  const info: GameInfo = { kind: 'source', labels: [], refs: [] };
  const code = withoutComments(text);
  const declarations = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, s => s.replace(/[^\r\n]/g, ' '));
  const matches = (source: string, regex: RegExp, fn: (m: RegExpMatchArray, line: number) => void) => {
    let count = 0;
    for (const m of source.matchAll(regex)) {
      if (++count > 150) { info.partial = true; break; }
      fn(m, source.slice(0, m.index).split('\n').length);
    }
  };
  const ref = (kind: GameRef['kind'], target: string, line: number) => {
    if (target.length <= 240 && info.refs.length < 150) info.refs.push({ kind, target, line });
    else info.partial = true;
  };
  if (/\.(unity|prefab|asset|mat|controller|overridecontroller|anim|meta|asmdef|asmref)$/.test(ext) ||
      /^(Assets|ProjectSettings)\//.test(file) || file === 'Packages/manifest.json') info.engine = 'unity';
  if (/\.(uproject|uplugin|cpp|hpp|h)$/.test(ext) || /\.(Build|Target)\.cs$/.test(file)) {
    if (/\.(uproject|uplugin)$/.test(ext) || /^(Source|Config|Plugins)\//.test(file)) info.engine = 'unreal';
  }
  if (ext === '.meta') {
    info.kind = 'metadata'; info.guid = text.match(/^guid:\s*([a-f0-9]{32})\s*$/m)?.[1];
    if (text.trimStart().startsWith('{')) { try { const data = JSON.parse(text); if (typeof data.uuid === 'string') { info.guid = data.uuid; info.engine = 'h5'; } } catch { info.partial = true; } }
  } else if ((ext === '.scene' || ext === '.prefab') && /^[\[{]/.test(text.trimStart())) {
    info.engine = 'h5'; info.kind = ext === '.scene' ? 'scene' : 'prefab';
    matches(text, /"__uuid__"\s*:\s*"([^"]+)"/g, (m,line) => ref('guid',m[1],line));
    matches(text, /"_name"\s*:\s*"([^"]+)"/g, m => info.labels.push(m[1]));
    try { JSON.parse(text); } catch { info.partial = true; }
  } else if (/\.(unity|prefab|asset|mat|controller|overridecontroller|anim)$/.test(ext)) {
    info.kind = ({ '.unity':'scene', '.prefab':'prefab', '.controller':'animator', '.mat':'material' } as Record<string,string>)[ext] ?? 'asset';
    info.partial = !text.startsWith('%YAML');
    matches(text, /\bguid:\s*([a-f0-9]{32})/g, (m,line) => { if (!/^0+$/.test(m[1])) ref('guid', m[1], line); });
    matches(text, /^\s*m_(?:Name|MethodName):\s*(.+)$/gm, m => info.labels.push(m[1].trim()));
  } else if (ext === '.asmdef' || ext === '.asmref') {
    info.kind = 'assembly';
    try {
      const data = JSON.parse(text); if (typeof data.name === 'string') info.labels.push(data.name);
      for (const value of [...(Array.isArray(data.references) ? data.references : []), ...(data.reference ? [data.reference] : [])]) {
        if (typeof value === 'string') ref(value.startsWith('GUID:') ? 'guid' : 'module', value.replace(/^GUID:/,''), 1);
      }
    } catch { info.partial = true; }
  } else if (ext === '.cs' || ['.h','.hpp','.cpp','.cc'].includes(ext)) {
    info.kind = /\.(Build|Target)\.cs$/.test(file) ? 'module' : 'script';
    matches(declarations, /\b(?:class|struct|interface)\s+(?:\w+_API\s+)?(\w+)(?:\s*:\s*(?:public\s+|protected\s+|private\s+)?([\w.]+))?/g, (m,line) => {
      info.labels.push(m[1]); if (m[2]) ref('symbol', m[2], line);
    });
    if (ext === '.cs' && !info.engine && /\b(UnityEngine|MonoBehaviour|ScriptableObject)\b/.test(declarations)) info.engine = 'unity';
    matches(code, /^\s*#include\s*"([^"]+)"/gm, (m,line) => ref('include',m[1],line));
    matches(code, /(?:Public|Private)DependencyModuleNames\s*\.Add(?:Range)?\s*\(([\s\S]*?)\);/g, (m,line) => {
      for (const value of m[1].matchAll(/"([\w.-]+)"/g)) ref('module',value[1],line);
    });
    if (/\.Build\.cs$/.test(file)) info.labels.push(posix.basename(file,'.Build.cs'));
  } else if (ext === '.uproject' || ext === '.uplugin') {
    info.kind = 'project';
    try {
      const data = JSON.parse(text);
      if (typeof data.EngineAssociation === 'string') info.labels.push('Unreal '+data.EngineAssociation);
      for (const mod of data.Modules ?? []) if (typeof mod.Name === 'string') ref('module',mod.Name,1);
    } catch { info.partial = true; }
  } else if (/\.[cm]?[jt]sx?$/.test(file)) {
    info.kind = /\bextends\s+(?:Phaser\.)?Scene\b/.test(declarations) ? 'scene' : 'script';
    matches(code, /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g, (m,line) => ref('import',m[1],line));
    matches(declarations, /\b(?:class|function)\s+(\w+)/g, m => info.labels.push(m[1]));
    matches(code, /\b(?:super\s*\(\s*|key\s*:\s*)['"]([^'"]+)['"]/g, m => { if (info.kind === 'scene') info.labels.push('scene:'+m[1]); });
    matches(code, /\bscene\.(?:start|launch|switch|run)\s*\(\s*['"]([^'"]+)['"]/g, (m,line) => ref('scene-key',m[1],line));
    matches(code, /\bload\.(?:image|spritesheet|atlas|audio|tilemapTiledJSON|json)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g, (m,line) => {
      info.labels.push('asset:'+m[1]); ref('asset-path',m[2],line);
    });
    if (/\b(?:Phaser|PIXI|THREE|BABYLON|Laya)\b/.test(declarations) || /(?:phaser|pixi\.js|three|babylonjs|@babylonjs|from\s*['"]cc['"])/.test(code)) info.engine = 'h5';
  } else if (posix.basename(file) === 'package.json' || file === 'Packages/manifest.json') {
    info.kind = 'project';
    try {
      const data = JSON.parse(text);
      const deps = { ...data.dependencies, ...data.devDependencies };
      for (const [name, version] of Object.entries(deps)) {
        if (/^(phaser|pixi\.js|three|babylonjs|@babylonjs\/core|@cocos\/creator|layaair)$/.test(name)) {
          info.engine = 'h5'; info.labels.push(name+' '+String(version));
        }
        if (file === 'Packages/manifest.json' && name.startsWith('com.unity.')) info.labels.push(name+' '+String(version));
      }
    } catch { info.partial = true; }
  } else if (file === 'ProjectSettings/ProjectVersion.txt') {
    info.kind = 'project'; const version = text.match(/m_EditorVersion:\s*(\S+)/)?.[1]; if (version) info.labels.push('Unity '+version);
  } else if (ext === '.ini') { info.kind = 'config'; if (file.startsWith('Config/')) info.engine = 'unreal'; }
  if (info.engine === 'unreal' || ext === '.ini') matches(code, /(?:\/Game\/)[A-Za-z0-9_\/.-]+/g, (m,line) => ref('asset-path',m[0],line));
  if (['.json','.html'].includes(ext) && !['package.json','manifest.json'].includes(posix.basename(file))) {
    matches(code, /(?:["'](?:url|src|path|texture)["']\s*:\s*|\bsrc\s*=\s*)["']([^"'\r\n]+)["']/g, (m,line) => ref('asset-path',m[1],line));
  }
  if (info.labels.length > 16) info.partial = true;
  info.labels = [...new Set(info.labels)].filter(s => s.length <= 160).slice(0,16);
  info.refs = info.refs.filter((r,i,all) => all.findIndex(v => v.kind === r.kind && v.target === r.target) === i);
  return info;
}
