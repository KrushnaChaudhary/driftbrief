import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { atomicWrite, identity, jsonFile, readText, safePath } from './fs.js';
import { inventory, containsSecret } from './scan.js';
import { parseDocument } from './parse.js';
import { hash } from './fs.js';
import { LIMITS, SCHEMA, type Snapshot, type Brief } from './types.js';

export const stateDir = '.driftbrief/state';
export async function ensureState(root: string): Promise<void> {
  await fs.mkdir(await safePath(root, stateDir, true), { recursive: true });
  await fs.writeFile(await safePath(root, '.driftbrief/state/owner.json', true), JSON.stringify({ package: 'driftbrief', schema: SCHEMA }), { flag: 'wx', mode: 0o600 }).catch((e: any) => { if (e.code !== 'EEXIST') throw e; });
  const ignorePath = await safePath(root, '.driftbrief/.gitignore', true);
  await fs.writeFile(ignorePath, 'state/\nbackups/\nreports/\ninstall.json\n', { flag: 'wx' }).catch((e: any) => { if (e.code !== 'EEXIST') throw e; });
}
export async function loadSnapshot(root: string, compact = false): Promise<Snapshot | null> {
  root = await fs.realpath(root);
  const pointer = await jsonFile<{ generation: string }>(root, `${stateDir}/current.json`, 1024);
  if (!pointer || !/^[a-f0-9-]{36}$/.test(pointer.generation)) return null;
  const snapshot = await jsonFile<Snapshot>(root, `${stateDir}/generations/${pointer.generation}${compact ? '.hook' : ''}.json`, compact ? LIMITS.hookIndexBytes : 16 * 1024 * 1024);
  if (!snapshot || snapshot.schema !== SCHEMA || snapshot.generation !== pointer.generation ||
      snapshot.identity?.root !== root || !Array.isArray(snapshot.documents)) return null;
  return snapshot;
}
export async function reconcile(root: string, signal?: AbortSignal): Promise<Snapshot> {
  const ident = await identity(root, signal);
  const old = await loadSnapshot(root);
  const previous = new Map((old?.identity.id === ident.id ? old.documents : []).map(d => [d.path, d]));
  const { files, assets, omissions } = await inventory(root, signal);
  const documents: Snapshot['documents'] = [];
  let scannedBytes = 0; let indexBytes = 0;
  for (const file of files) {
    signal?.throwIfAborted();
    try {
      const size = (await fs.stat(await safePath(root, file))).size;
      if (size > LIMITS.totalBytes - scannedBytes) { omissions['byte-limit'] = (omissions['byte-limit'] ?? 0) + 1; continue; }
      const text = await readText(root, file);
      const bytes = Buffer.byteLength(text);
      if (scannedBytes + bytes > LIMITS.totalBytes) { omissions['byte-limit'] = (omissions['byte-limit'] ?? 0) + 1; continue; }
      scannedBytes += bytes;
      if (containsSecret(text)) { omissions['possible-secret'] = (omissions['possible-secret'] ?? 0) + 1; continue; }
      const prior = previous.get(file);
      const doc = prior?.hash === hash(text) ? prior : await parseDocument(file, text);
      indexBytes += Buffer.byteLength(JSON.stringify(doc));
      if (indexBytes > 12 * 1024 * 1024) { omissions['index-limit'] = files.length - documents.length; break; }
      documents.push(doc);
      if (doc.parseIncomplete) omissions['parser-incomplete'] = (omissions['parser-incomplete'] ?? 0) + 1;
    } catch { omissions['unreadable-binary-large-or-changing'] = (omissions['unreadable-binary-large-or-changing'] ?? 0) + 1; }
  }
  signal?.throwIfAborted();
  const after = await identity(root, signal);
  if (after.id !== ident.id || after.head !== ident.head) throw new Error('Git state changed while indexing; retry the request');
  return { schema: SCHEMA, identity: ident, generation: randomUUID(), reconciledAt: new Date().toISOString(), documents, omissions, scannedBytes, assets };
}
export async function publish(root: string, snapshot: Snapshot): Promise<boolean> {
  await ensureState(root);
  let release: (() => Promise<void>) | undefined; let compromised = false;
  try {
    release = await lockfile.lock(await safePath(root, stateDir), {
      realpath: false, stale: 10000, update: 2000, retries: 0,
      onCompromised: () => { compromised = true; }
    });
  } catch (e: any) { if (e.code === 'ELOCKED') return false; throw e; }
  try {
    const current = await loadSnapshot(root);
    if (current && current.reconciledAt > snapshot.reconciledAt) return false;
    const compact: Snapshot = { ...snapshot, documents: [], assets: [], omissions: { ...snapshot.omissions } };
    let compactBytes = Buffer.byteLength(JSON.stringify(compact));
    for (const doc of snapshot.documents) {
      const small = { ...doc, terms: Object.fromEntries(Object.entries(doc.terms).slice(0, 24)), symbols: doc.symbols.slice(0, 10), facts: doc.facts.slice(0, 8), game: { ...doc.game, refs: [] } };
      compactBytes += Buffer.byteLength(JSON.stringify(small)) + 2;
      if (compactBytes > LIMITS.hookIndexBytes - 1024) { compact.omissions['compact-index-limit'] = snapshot.documents.length - compact.documents.length; break; }
      compact.documents.push(small);
    }
    const base = `${stateDir}/generations/${snapshot.generation}`;
    await atomicWrite(root, `${base}.json`, JSON.stringify(snapshot));
    await atomicWrite(root, `${base}.hook.json`, JSON.stringify(compact));
    if (compromised) throw new Error('Writer lock lost; publication cancelled');
    await atomicWrite(root, `${stateDir}/current.json`, JSON.stringify({ generation: snapshot.generation }));
    // Keep the latest three generations; readers retry a moved pointer if a generation disappears.
    const dir = await safePath(root, `${stateDir}/generations`);
    const entries = await fs.readdir(dir);
    const stats = await Promise.all(entries.filter(n => /^[a-f0-9-]{36}(\.hook)?\.json$/.test(n)).map(async name => ({ name, mtime: (await fs.stat(path.join(dir, name))).mtimeMs })));
    const generations = [...new Set(stats.sort((a,b) => b.mtime-a.mtime).map(s => s.name.slice(0, 36)))];
    for (const gen of generations.slice(3)) for (const suffix of ['.json', '.hook.json'])
      await fs.rm(await safePath(root, `${stateDir}/generations/${gen}${suffix}`), { force: true });
    return true;
  } finally { await release().catch(() => {}); }
}
export async function saveReceipt(root: string, brief: Brief): Promise<void> {
  await ensureState(root);
  await atomicWrite(root, `${stateDir}/receipts/${brief.receiptId}.json`, JSON.stringify(brief));
  const dir = await safePath(root, `${stateDir}/receipts`);
  const names = (await fs.readdir(dir)).filter(n => /^\d+-[a-f0-9-]{36}\.json$/.test(n)).sort().reverse();
  for (const name of names.slice(LIMITS.receipts)) await fs.rm(await safePath(root, `${stateDir}/receipts/${name}`), { force: true }).catch(() => {});
}
export async function receipts(root: string): Promise<Brief[]> {
  try {
    const names = (await fs.readdir(await safePath(root, `${stateDir}/receipts`))).filter(n => /^\d+-[a-f0-9-]{36}\.json$/.test(n)).sort().slice(-LIMITS.receipts);
    return (await Promise.all(names.map(n => jsonFile<Brief>(root, `${stateDir}/receipts/${n}`, 40000)))).filter((b): b is Brief => Boolean(b?.evidence && b.schema === SCHEMA));
  } catch { return []; }
}
