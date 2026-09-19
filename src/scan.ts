import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { git, readText, safePath, slash } from './fs.js';
import { LIMITS } from './types.js';

const excludedDirs = new Set(['.git', '.driftbrief', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.next', '.nuxt', '.venv', 'venv', '__pycache__', '.cache', '.tox', 'target', '.idea', '.codex', '.claude', '.cursor', '.agents', 'Library', 'Temp', 'Logs', 'Obj', 'obj', 'UserSettings', 'MemoryCaptures', 'Recordings', 'Binaries', 'Intermediate', 'Saved', 'DerivedDataCache', '.vs', 'library', 'temp']);
const secretName = /(^\.env($|\.)|credentials|secrets?\.|\.pem$|\.key$|\.p12$|\.pfx$|^id_(rsa|ed25519)$|^\.npmrc$|^\.netrc$)/i;
const binaryExt = /\.(png|jpe?g|gif|ico|webp|svg|pdf|zip|gz|tgz|woff2?|ttf|exe|dll|so|wasm|mp[34]|mov|lock|map|min\.js)$/i;
export function opaqueAsset(name: string): boolean {
  return /\.(uasset|umap|png|jpe?g|webp|gif|ogg|wav|mp3|fbx|glb|gltf|blend|mp4|ttf|woff2?)$/i.test(name) && eligible(name + '.source');
}
export function eligible(name: string): boolean {
  const parts = name.replaceAll('\\', '/').split('/');
  return !parts.some(p => excludedDirs.has(p) || secretName.test(p)) &&
    !binaryExt.test(name) && !/^(AGENTS(?:\.override)?|CLAUDE)\.md$/i.test(parts.at(-1) ?? '') &&
    !['.gitignore', '.driftbriefignore', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'uv.lock', 'poetry.lock'].includes(parts.at(-1) ?? '');
}
export function containsSecret(text: string): boolean {
  return /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{15,})\b/.test(text) ||
    /(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*["'][^"'\s]{12,}["']/i.test(text);
}
export async function inventory(root: string, signal?: AbortSignal): Promise<{ files: string[]; assets: string[]; omissions: Record<string, number> }> {
  const omissions: Record<string, number> = {};
  const skip = (reason: string) => omissions[reason] = (omissions[reason] ?? 0) + 1;
  const candidates: string[] = [];
  const extra = ignore();
  try { extra.add(await readText(root, '.driftbriefignore')); } catch { /* optional */ }
  const gitFiles = await git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'], signal);
  if (gitFiles !== null) {
    for (const file of gitFiles.split('\0').filter(Boolean)) candidates.push(file);
  } else {
    const walk = async (dir: string, parentRules: Array<{ base: string; rules: ReturnType<typeof ignore> }>, depth = 0) => {
      signal?.throwIfAborted();
      if (depth > 40 || candidates.length >= LIMITS.files * 2) { skip('inventory-limit'); return; }
      const rules = [...parentRules];
      try { rules.push({ base: dir, rules: ignore().add(await readText(root, path.join(dir, '.gitignore'))) }); } catch { /* optional */ }
      const entries = await fs.readdir(await safePath(root, dir), { withFileTypes: true });
      for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
        signal?.throwIfAborted();
        const rel = slash(path.join(dir, entry.name));
        if (entry.isSymbolicLink() || (!eligible(rel) && !opaqueAsset(rel)) || extra.ignores(rel) ||
            rules.some(r => r.rules.ignores(slash(path.relative(r.base || '.', rel)) + (entry.isDirectory() ? '/' : '')))) { skip('excluded'); continue; }
        if (entry.isDirectory()) await walk(rel, rules, depth + 1);
        else if (entry.isFile()) candidates.push(rel);
        if (candidates.length >= LIMITS.files * 2) { skip('inventory-limit'); break; }
      }
    };
    await walk('', []);
  }
  const files: string[] = []; const assets: string[] = []; let assetBytes = 0;
  for (const file of [...new Set(candidates)].sort()) {
    signal?.throwIfAborted();
    if ((!eligible(file) && !opaqueAsset(file)) || extra.ignores(file)) { skip('excluded'); continue; }
    try { await safePath(root, file); } catch { skip('unavailable-or-symlink'); continue; }
    if (opaqueAsset(file)) { assetBytes += Buffer.byteLength(file) + 4; if (assets.length < LIMITS.files && assetBytes <= 512 * 1024) assets.push(file); else skip('asset-limit'); continue; }
    if (files.length >= LIMITS.files) { skip('file-limit'); continue; }
    files.push(file);
  }
  return { files, assets, omissions };
}
