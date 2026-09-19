import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { identity, jsonFile } from './fs.js';
import { context, serializeBrief } from './context.js';
import { init, uninstall, doctor } from './install.js';
import { serve } from './mcp.js';
import { report } from './viewer.js';
import { benchmark } from './bench.js';
import { loadSnapshot } from './state.js';
import { VERSION } from './types.js';

function args(argv: string[]) {
  const positional: string[] = []; const flags: Record<string,string|boolean> = {};
  for (let i=0;i<argv.length;i++) {
    if (argv[i].startsWith('--')) {
      const [key, value] = argv[i].slice(2).split('=',2);
      if (value !== undefined) flags[key] = value;
      else if (['hooks','json','html','help','version'].includes(key)) flags[key] = true;
      else if (argv[i+1] && !argv[i+1].startsWith('--')) flags[key] = argv[++i];
      else throw new Error(`Missing value for --${key}`);
    } else positional.push(argv[i]);
  }
  return { command: positional.shift() ?? 'help', positional, flags };
}
async function main() {
  const raw = process.argv.slice(2); const separator = raw.indexOf('--');
  const forwarded = separator < 0 ? [] : raw.slice(separator + 1);
  const { command, positional, flags } = args(separator < 0 ? raw : raw.slice(0, separator));
  if (flags.version || command === 'version') { console.log(VERSION); return; }
  if (flags.help || command === 'help') {
    console.log(`DriftBrief ${VERSION} — source-checked project context\n\nCommands:\n  init --clients codex,claude,cursor [--hooks]\n  context "task query" [--paths src,tests] [--max-bytes 8000]\n  mcp                 Start stdio MCP; lifetime belongs to its client\n  launch codex        Scoped CLI fallback for hosts ignoring project MCP config\n  status              Inspect the current index\n  doctor              Check installation without changing settings\n  inspect --html      Generate an offline evidence report\n  bench               Run a free deterministic retrieval benchmark\n  uninstall           Remove unchanged integration entries\n\nAll commands accept --root <project>. Prompt hooks are experimental and off by default.\nNo accounts, model calls, or network access. Source excerpts pass through your AI client.`); return;
  }
  if (![22,24].includes(Number(process.versions.node.split('.')[0]))) throw new Error('DriftBrief supports Node.js 22 and 24.');
  const root = await fs.realpath(path.resolve(String(flags.root ?? process.cwd())));
  if (command === 'hook') {
    const abort = new AbortController(); const timer = setTimeout(() => { abort.abort(); process.exit(0); }, 500); timer.unref();
    try {
      const installation = await jsonFile<{ hooks: boolean }>(root, '.driftbrief/install.json');
      if (!installation?.hooks) return;
      let input = ''; for await (const part of process.stdin) { input += part; if (Buffer.byteLength(input) > 64000) return; }
      const event = JSON.parse(input);
      if (event.hook_event_name !== 'UserPromptSubmit' || typeof event.prompt !== 'string' || typeof event.cwd !== 'string') return;
      if ((await fs.realpath(event.cwd)) !== root) return;
      const brief = await context(root, { query: event.prompt, maxBytes: 3200, hook: true, signal: abort.signal });
      if (!brief.evidence.length || abort.signal.aborted) return;
      let output = '';
      do {
        output = JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: serializeBrief(brief, 3200) } });
        if (Buffer.byteLength(output) <= 4000) break;
        brief.evidence.pop(); brief.omissions['response-budget'] = (brief.omissions['response-budget'] ?? 0) + 1;
      } while (brief.evidence.length);
      if (brief.evidence.length && Buffer.byteLength(output) <= 4000) process.stdout.write(output + '\n');
    } catch { /* advisory hooks always fail open with no user prompt/transcript retention */ }
    finally { clearTimeout(timer); }
    return;
  }
  if (command === 'launch') {
    if (positional[0] !== 'codex') throw new Error('The scoped launcher currently supports codex only.');
    const runtime = fileURLToPath(import.meta.url);
    const launchArgs = ['-C', root, '-c', `mcp_servers.driftbrief.command=${JSON.stringify(process.execPath)}`, '-c', `mcp_servers.driftbrief.args=${JSON.stringify([runtime, 'mcp', '--root', root])}`, ...forwarded];
    const code = await new Promise<number>(resolve => {
      const child = spawn('codex', launchArgs, { cwd: root, stdio: 'inherit', windowsHide: true, shell: false });
      child.on('error', () => resolve(1)); child.on('close', code => resolve(code ?? 1));
    });
    process.exitCode = code; return;
  }
  if (command === 'mcp') { await serve(root); return; }
  let result: unknown;
  switch (command) {
    case 'init': result = await init(root, String(flags.clients ?? 'codex,claude,cursor').split(',') as any, flags.hooks === true); break;
    case 'context': {
      const query = positional.join(' '); if (!query) throw new Error('Provide a task query.');
      const maxBytes = flags['max-bytes'] === undefined ? 8000 : Number(flags['max-bytes']);
      if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 32000) throw new Error('--max-bytes must be 1024–32000');
      const brief = await context(root, { query, maxBytes, paths: flags.paths ? String(flags.paths).split(',') : undefined });
      process.stdout.write(serializeBrief(brief,maxBytes) + '\n'); return;
    }
    case 'doctor': result = await doctor(root); break;
    case 'status': { const snapshot = await loadSnapshot(root); const ident = await identity(root); result = { version: VERSION, indexedFiles: snapshot?.documents.length ?? 0, indexReconciledAt: snapshot?.reconciledAt ?? null, sameWorktree: snapshot?.identity.id === ident.id, sameCommit: snapshot?.identity.head === ident.head, note: 'Status describes the cached index. Requests verify source again.' }; break; }
    case 'uninstall': result = await uninstall(root); break;
    case 'inspect': result = { report: path.join(root, await report(root)) }; break;
    case 'bench': result = await benchmark(root); break;
    default: throw new Error(`Unknown command: ${command}`);
  }
  console.log(JSON.stringify(result,null,2));
}
main().catch(error => {
  if (process.argv[2] === 'hook') { process.exitCode = 0; return; }
  console.error(`DriftBrief: ${error instanceof Error ? error.message : 'Operation failed'}`); process.exitCode = 1;
});
