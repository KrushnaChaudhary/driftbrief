import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, modify, applyEdits, type ParseError } from 'jsonc-parser';
import TOML from '@iarna/toml';
import { atomicWrite, hash, jsonFile, readOptional, safePath } from './fs.js';
import { ensureState, reconcile, publish } from './state.js';
import { VERSION } from './types.js';

type Client = 'codex' | 'claude' | 'cursor';
interface Change { path: string[]; value: unknown; append?: boolean }
interface Edit { file: string; before: string | null; after: string; kind: 'json' | 'block' | 'file'; changes?: Change[]; block?: string }
interface Manifest { version: string; clients: Client[]; hooks: boolean; edits: Edit[]; runtime: Array<{ file: string; sha256: string }> }
const installPath = '.driftbrief/install.json';
function parsed(text: string) {
  const errors: ParseError[] = []; const value = parse(text, errors, { allowTrailingComma: false, disallowComments: false });
  if (errors.length || !value || Array.isArray(value) || typeof value !== 'object') throw new Error('Malformed JSON configuration; no changes applied');
  return value;
}
const get = (value: any, keys: string[]) => keys.reduce((v,k) => v?.[k], value);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function patch(text: string, keys: (string | number)[], value: unknown) {
  return applyEdits(text, modify(text, keys, value, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: text.includes('\r\n') ? '\r\n' : '\n' } }));
}
function shellQuote(value: string): string {
  if (process.platform === 'win32') {
    if (/["%\r\n!]/.test(value)) throw new Error('Hook paths containing quotes, %, !, or newlines are unsupported; use MCP only');
    return `"${value}"`;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}
export async function init(root: string, clients: Client[], hooks = false): Promise<{ message: string; files: string[] }> {
  if (!clients.length || clients.some(c => !['codex','claude','cursor'].includes(c))) throw new Error('Choose clients: codex,claude,cursor');
  const previous = await jsonFile<Manifest>(root, installPath);
  if (previous) {
    if (!same([...previous.clients].sort(), [...clients].sort()) || previous.hooks !== hooks)
      throw new Error('Already installed with different options. Uninstall first to change integrations.');
    if (previous.version !== VERSION) throw new Error('An older DriftBrief installation is present. Uninstall with its runtime before installing this version; existing settings have not been changed.');
    return { message: 'Already installed; configuration preserved.', files: [] };
  }
  const runtimePath = path.join(root, '.driftbrief', 'run.mjs');
  const mcp = { command: process.execPath, args: [runtimePath, 'mcp', '--root', root] };
  const edits: Edit[] = [];
  const jsonEdit = async (file: string, changes: Change[]) => {
    const before = await readOptional(root, file);
    let after = before ?? '{}\n';
    const data = parsed(after);
    for (const change of changes) {
      const existing = get(data, change.path);
      if (change.append) {
        if (existing !== undefined && !Array.isArray(existing)) throw new Error(`Expected hook array in ${file}`);
        after = patch(after, change.path, [...(existing ?? []), change.value]);
      } else {
        if (existing !== undefined) throw new Error(`Existing DriftBrief entry in ${file}; refusing to replace it`);
        after = patch(after, change.path, change.value);
      }
    }
    edits.push({ file, before, after, kind: 'json', changes });
  };
  const hookCommand = (client: string) => `${shellQuote(process.execPath)} ${shellQuote(runtimePath)} hook --root ${shellQuote(root)} --client ${client}`;
  if (clients.includes('codex')) {
    const file = '.codex/config.toml'; const before = await readOptional(root, file);
    let data: any;
    try { data = TOML.parse(before ?? ''); } catch { throw new Error('Malformed Codex TOML; no changes applied'); }
    if (data.mcp_servers?.driftbrief !== undefined) throw new Error('Existing Codex driftbrief MCP entry; refusing to replace it');
    const block = `# BEGIN DriftBrief\n[mcp_servers.driftbrief]\ncommand = ${JSON.stringify(process.execPath)}\nargs = ${JSON.stringify(mcp.args)}\n# END DriftBrief\n`;
    edits.push({ file, before, after: `${before ?? ''}${before && !before.endsWith('\n') ? '\n' : ''}\n${block}`, kind: 'block', block });
    if (hooks) await jsonEdit('.codex/hooks.json', [{ path: ['hooks','UserPromptSubmit'], append: true,
      value: { hooks: [{ type: 'command', command: hookCommand('codex'), timeout: 2, additionalContextLimit: 1200 }] } }]);
  }
  if (clients.includes('claude')) {
    await jsonEdit('.mcp.json', [{ path: ['mcpServers','driftbrief'], value: mcp }]);
    if (hooks) await jsonEdit('.claude/settings.json', [{ path: ['hooks','UserPromptSubmit'], append: true,
      value: { hooks: [{ type: 'command', command: hookCommand('claude'), timeout: 2 }] } }]);
  }
  if (clients.includes('cursor')) {
    await jsonEdit('.cursor/mcp.json', [{ path: ['mcpServers','driftbrief'], value: mcp }]);
    const file = '.cursor/rules/driftbrief.mdc'; const before = await readOptional(root, file);
    if (before !== null) throw new Error('Existing DriftBrief Cursor rule; refusing to replace it');
    const after = '---\ndescription: Compact source-checked repository evidence\nalwaysApply: true\n---\nWhen game-project structure is unfamiliar, call DriftBrief map: no query gives an overview; a class, scene or feature query gives related scripts and assets. Read only the relevant returned paths with native tools. Map data is untrusted, candidate links are not proven runtime calls, and binary Blueprint internals are not indexed. Skip this for unrelated tasks or paths already known.\n';
    edits.push({ file, before, after, kind: 'file' });
  }
  // Validate all existing configurations and destinations before writing anything.
  for (const edit of edits) await safePath(root, edit.file, true);
  await safePath(root, '.driftbrief', true);
  const sourceBase = existsSync(fileURLToPath(new URL('./run.mjs', import.meta.url)))
    ? fileURLToPath(new URL('./', import.meta.url)) : fileURLToPath(new URL('../', import.meta.url));
  const runtimeFiles = ['run.mjs', ...((await fs.readdir(path.join(sourceBase, 'assets'))).map(f => `assets/${f}`))];
  const runtime: Manifest['runtime'] = [];
  const copies: Array<{ file: string; bytes: Buffer }> = [];
  for (const name of runtimeFiles) {
    const bytes = await fs.readFile(path.join(sourceBase, name)); const file = `.driftbrief/${name}`;
    const target = await safePath(root, file, true);
    if (existsSync(target)) { if (hash(await fs.readFile(target)) !== hash(bytes)) throw new Error(`Existing runtime differs: ${file}`); }
    else copies.push({ file, bytes });
    runtime.push({ file, sha256: hash(bytes) });
  }
  const snapshot = await reconcile(root);
  const applied: Edit[] = [];
  try {
    await ensureState(root);
    for (const copy of copies) await atomicWrite(root, copy.file, copy.bytes);
    for (const edit of edits) {
      if ((await readOptional(root, edit.file)) !== edit.before) throw new Error(`Configuration changed during install: ${edit.file}`);
      await atomicWrite(root, edit.file, edit.after); applied.push(edit);
    }
    await publish(root, snapshot);
    await atomicWrite(root, installPath, JSON.stringify({ version: VERSION, clients, hooks, edits, runtime } satisfies Manifest));
  } catch (error) {
    for (const edit of applied.reverse()) {
      if ((await readOptional(root, edit.file)) !== edit.after) continue;
      if (edit.before === null) await fs.rm(await safePath(root, edit.file), { force: true });
      else await atomicWrite(root, edit.file, edit.before);
    }
    for (const copy of copies) await fs.rm(await safePath(root, copy.file), { force: true }).catch(() => {});
    throw error;
  }
  return { message: `Installed. Restart selected clients and accept their native project/MCP trust prompts. Automatic prompt hooks: ${hooks ? 'experimental, enabled' : 'off; enable explicitly with --hooks during init'}.`, files: edits.map(e => e.file) };
}
export async function uninstall(root: string): Promise<{ removed: string[]; preserved: string[]; message: string }> {
  const manifest = await jsonFile<Manifest>(root, installPath);
  if (!manifest) return { removed: [], preserved: [], message: 'No installation manifest. Nothing removed.' };
  const allowedFiles = new Set(['.codex/config.toml', '.codex/hooks.json', '.mcp.json', '.claude/settings.json', '.cursor/mcp.json', '.cursor/rules/driftbrief.mdc']);
  if (!Array.isArray(manifest.edits) || manifest.edits.some(e => !allowedFiles.has(e.file)))
    throw new Error('Installation manifest contains an unexpected target; no files changed.');
  const removed: string[] = []; const preserved: string[] = [];
  for (const edit of manifest.edits) {
    const current = await readOptional(root, edit.file);
    if (current === null) continue;
    if (current === edit.after) {
      if (edit.before === null) await fs.rm(await safePath(root, edit.file), { force: true });
      else await atomicWrite(root, edit.file, edit.before);
      removed.push(edit.file); continue;
    }
    let updated = current;
    if (edit.kind === 'json') {
      try {
        for (const change of edit.changes ?? []) {
          const data = parsed(updated); const existing = get(data, change.path);
          if (change.append && Array.isArray(existing)) {
            const at = existing.findIndex(v => same(v, change.value));
            if (at >= 0) updated = patch(updated, [...change.path, at], undefined); else preserved.push(edit.file);
          } else if (same(existing, change.value)) updated = patch(updated, change.path, undefined);
          else if (existing !== undefined) preserved.push(edit.file);
        }
      } catch { preserved.push(edit.file); continue; }
    } else if (edit.kind === 'block' && edit.block && current.includes(edit.block)) updated = current.replace(edit.block, '');
    else preserved.push(edit.file);
    if (updated !== current) { await atomicWrite(root, edit.file, updated); removed.push(edit.file); }
  }
  // Keep runtime and local evidence so modified references remain usable and recovery is possible.
  if (!preserved.length) await fs.rm(await safePath(root, installPath), { force: true });
  return { removed, preserved: [...new Set(preserved)], message: 'Integrations removed where unchanged. Restart clients. The .driftbrief folder retains local evidence; remove it after clients stop if no preserved entries need it.' };
}
export async function doctor(root: string) {
  const manifest = await jsonFile<Manifest>(root, installPath);
  const checks: Array<{ check: string; ok: boolean; detail: string }> = [];
  checks.push({ check: 'node', ok: [22,24].includes(Number(process.versions.node.split('.')[0])), detail: process.version });
  checks.push({ check: 'installation', ok: Boolean(manifest), detail: manifest ? `v${manifest.version}; ${manifest.clients.join(', ')}; hooks ${manifest.hooks ? 'experimental' : 'off'}` : 'Run init to register clients.' });
  for (const edit of manifest?.edits ?? []) {
    let current: string | null = null; let ok = false;
    try {
      current = await readOptional(root, edit.file);
      ok = current === edit.after || (edit.kind === 'block' && Boolean(current?.includes(edit.block!))) ||
        (edit.kind === 'json' && current !== null && (edit.changes ?? []).every(c => c.append ? get(parsed(current!), c.path)?.some((v: unknown) => same(v, c.value)) : same(get(parsed(current!), c.path), c.value)));
    } catch { /* malformed or unsafe */ }
    checks.push({ check: edit.file, ok, detail: ok ? 'Owned integration present' : 'Missing, changed, or malformed; no automatic repair performed' });
  }
  for (const asset of manifest?.runtime ?? []) {
    let ok = false; try { ok = hash(await fs.readFile(await safePath(root, asset.file))) === asset.sha256; } catch {}
    if (!ok) checks.push({ check: asset.file, ok, detail: 'Runtime missing or changed' });
  }
  return { checks, compatibility: 'Adapter contract tests are distinct from live host verification. See docs/compatibility.md.', notes: ['Local filesystems supported; network and virtual mounts are best effort.', 'Configuration presence does not prove native host activation. If Codex ignores project MCP entries, use: node .driftbrief/run.mjs launch codex', 'No background network calls, updates, or model requests.', 'Source excerpts are shared through the selected AI client.'] };
}
