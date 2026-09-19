import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { Identity } from './types.js';
import { LIMITS } from './types.js';

export const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export const slash = (v: string) => v.split(path.sep).join('/');
export const inside = (root: string, target: string) => {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
};
export async function git(root: string, args: string[], signal?: AbortSignal): Promise<string | null> {
  if (signal?.aborted) throw signal.reason;
  return new Promise((resolve, reject) => {
    execFile('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024, signal },
      (error, stdout) => { if (signal?.aborted) reject(signal.reason); else resolve(error ? null : stdout.trimEnd()); });
  });
}
export async function identity(rootArg: string, signal?: AbortSignal): Promise<Identity> {
  const root = await fs.realpath(path.resolve(rootArg));
  const gitDir = await git(root, ['rev-parse', '--absolute-git-dir'], signal);
  const head = gitDir ? await git(root, ['rev-parse', 'HEAD'], signal) : null;
  return { root, gitDir, head, id: hash(`${root}\0${gitDir ?? ''}`).slice(0, 24) };
}
// Reject symlinks at every component: both reads and writes stay within the selected root.
export async function safePath(root: string, relative: string, allowMissing = false): Promise<string> {
  if (relative.includes('\0') || path.isAbsolute(relative)) throw new Error('Unsafe path');
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error('Path escapes project');
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Symlinks are excluded'); }
    catch (e: any) { if (!(allowMissing && e.code === 'ENOENT')) throw e; }
  }
  return target;
}
export async function readText(root: string, relative: string, cap = LIMITS.fileBytes): Promise<string> {
  const target = await safePath(root, relative);
  const handle = await fs.open(target, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > cap) throw new Error('File exceeds limit');
    const buffer = Buffer.alloc(Math.min(cap + 1, before.size + 1));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const after = await handle.stat();
    const current = await fs.stat(await safePath(root, relative));
    if (bytesRead !== before.size || bytesRead > cap || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        before.ino !== current.ino || after.size !== current.size || after.mtimeMs !== current.mtimeMs)
      throw new Error('Source changed during reading');
    const bytes = buffer.subarray(0, bytesRead);
    if (bytes.includes(0)) throw new Error('Binary file');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally { await handle.close(); }
}
export async function atomicWrite(root: string, relative: string, data: string | Buffer): Promise<void> {
  const target = await safePath(root, relative, true);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await safePath(root, relative, true);
  const temp = `${target}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temp, data, { flag: 'wx', mode: 0o600 }); await fs.rename(temp, target); }
  finally { await fs.rm(temp, { force: true }).catch(() => {}); }
}
export async function jsonFile<T>(root: string, relative: string, cap = 16 * 1024 * 1024): Promise<T | null> {
  try { return JSON.parse(await readText(root, relative, cap)) as T; } catch { return null; }
}
export async function readOptional(root: string, relative: string): Promise<string | null> {
  try { return await readText(root, relative, 4 * 1024 * 1024); }
  catch (e: any) { if (e.code === 'ENOENT') return null; throw e; }
}
