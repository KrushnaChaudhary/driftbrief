import path from 'node:path';
import { gameInfo } from './games.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Parser, Language } from 'web-tree-sitter';
import TOML from '@iarna/toml';
import type { Document, Fact, SymbolInfo } from './types.js';
import { hash } from './fs.js';

const localAssets = fileURLToPath(new URL('./assets/', import.meta.url));
const assets = existsSync(localAssets) ? localAssets : fileURLToPath(new URL('../assets/', import.meta.url));
let initialized: Promise<void> | undefined;
const languages = new Map<string, Language>();
const stop = new Set(['the','and','for','from','with','this','that','const','return','import','export','function','class','def','self','true','false','null','undefined','please','could','would','should','into','have','what','where','how']);
export function terms(text: string): string[] {
  return (text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9_]{2,64}/g) ?? [])
    .flatMap(t => [t, ...t.split('_').filter(p => p !== t)]).filter(t => t.length > 1 && !stop.has(t));
}
export function manifestFacts(file: string, text: string): Fact[] {
  const facts: Fact[] = [];
  try {
    if (path.basename(file) === 'package.json') {
      const data = JSON.parse(text);
      for (const [name, value] of Object.entries(data.scripts ?? {}))
        if (typeof value === 'string') facts.push({ kind: 'declared-script', name, value });
      for (const key of ['dependencies', 'devDependencies'])
        for (const [name, value] of Object.entries(data[key] ?? {}))
          if (typeof value === 'string') facts.push({ kind: 'declared-dependency', name, value });
      if (typeof data.packageManager === 'string') facts.push({ kind: 'package-manager', name: 'packageManager', value: data.packageManager });
    } else if (path.basename(file) === 'pyproject.toml') {
      const data = TOML.parse(text) as any;
      for (const [name, value] of Object.entries(data.project?.scripts ?? {}))
        if (typeof value === 'string') facts.push({ kind: 'python-entrypoint', name, value });
      for (const value of data.project?.dependencies ?? [])
        if (typeof value === 'string') facts.push({ kind: 'declared-dependency', name: value, value });
      const pytest = data.tool?.pytest?.ini_options;
      if (pytest?.testpaths) facts.push({ kind: 'pytest-testpaths', name: 'testpaths', value: JSON.stringify(pytest.testpaths) });
    }
  } catch { /* malformed manifests remain source evidence, not fabricated facts */ }
  return facts.filter(f => f.name.length <= 200 && f.value.length <= 400).slice(0, 80);
}
export async function parseDocument(file: string, text: string): Promise<Document> {
  const game = gameInfo(file, text);
  const frequencies: Record<string, number> = Object.create(null);
  const searchable = game.kind === 'metadata' ? '' : ['prefab','scene','asset','material','animator'].includes(game.kind) && game.engine === 'unity' ? game.labels.join(' ') : text;
  for (const term of terms(searchable)) frequencies[term] = (frequencies[term] ?? 0) + 1;
  const boundedTerms = Object.fromEntries(Object.entries(frequencies).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, 300));
  const symbols: SymbolInfo[] = [];
  const extension = path.extname(file).toLowerCase();
  const grammar = ({ '.js':'javascript', '.mjs':'javascript', '.cjs':'javascript', '.jsx':'javascript', '.ts':'typescript', '.tsx':'tsx', '.py':'python' } as Record<string,string>)[extension];
  let parserName = 'text'; let parseIncomplete = false;
  if (grammar) {
    let parser: Parser | undefined;
    try {
      initialized ??= Parser.init({ locateFile: () => path.join(assets, 'web-tree-sitter.wasm') });
      await initialized;
      let language = languages.get(grammar);
      if (!language) { language = await Language.load(path.join(assets, `tree-sitter-${grammar}.wasm`)); languages.set(grammar, language); }
      parser = new Parser(); parser.setLanguage(language);
      const tree = parser.parse(text);
      if (tree) {
        parseIncomplete = tree.rootNode.hasError;
        const walk = (node: any) => {
          if (symbols.length >= 100) return;
          if (/^(function_declaration|function_definition|class_declaration|class_definition|method_definition|interface_declaration|type_alias_declaration|lexical_declaration)$/.test(node.type)) {
            const name = node.childForFieldName('name');
            if (name) symbols.push({ name: name.text.slice(0, 120), line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
          }
          for (const child of node.namedChildren) walk(child);
        };
        walk(tree.rootNode); tree.delete(); parserName = grammar;
      }
    } catch { parseIncomplete = true; }
    finally { parser?.delete(); }
  }
  return { path: file, hash: hash(text), bytes: Buffer.byteLength(text), terms: boundedTerms, symbols,
    facts: manifestFacts(file, text), parser: parserName, parseIncomplete, game };
}
