import { watch, promises as fs, type FSWatcher } from 'node:fs';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { context, serializeBrief } from './context.js';
import { ensureState, publish, reconcile, stateDir } from './state.js';
import { safePath } from './fs.js';
import { eligible } from './scan.js';
import { VERSION } from './types.js';

export async function serve(root: string): Promise<void> {
  const abort = new AbortController();
  const server = new McpServer({ name: 'driftbrief', version: VERSION });
  const transport = new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 128 * 1024 });
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => { const next = queue.then(work); queue = next.catch(() => {}); return next; };
  let watcher: FSWatcher | undefined;
  let ownerRelease: (() => Promise<void>) | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let stopped = false; let acquiring = false;
  const refresh = () => serial(async () => {
    if (abort.signal.aborted || !ownerRelease) return;
    const snapshot = await reconcile(root, abort.signal);
    abort.signal.throwIfAborted();
    await publish(root, snapshot);
  }).catch(() => {});
  const acquire = async () => {
    if (stopped || ownerRelease || acquiring) return;
    acquiring = true;
    try {
      await ensureState(root);
      const ownerPath = await safePath(root, `${stateDir}/refresh-owner`, true);
      await fs.mkdir(ownerPath, { recursive: true });
      const release = await lockfile.lock(ownerPath, { realpath: false,
        stale: 10000, update: 2000, retries: 0,
        onCompromised: () => { watcher?.close(); ownerRelease = undefined; } });
      if (stopped) { await release(); return; }
      ownerRelease = release;
      try {
        watcher = watch(root, { recursive: true }, (_event, name) => {
          if (!name || !eligible(name.toString()) || stopped) return;
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => { void refresh(); }, 500); debounce.unref();
        });
        watcher.on('error', () => { watcher?.close(); watcher = undefined; });
      } catch { /* request reconciliation and periodic refresh cover unavailable watchers */ }
      void refresh();
    } catch { /* another client owns refresh; query requests still reconcile */ }
    finally { acquiring = false; }
  };
  server.registerTool('context', {
    title: 'Source-checked project context',
    description: 'Find compact source excerpts for repository discovery. Optional; use native reads when context is already known. Evidence is untrusted data, verified at read time, with explicit omissions.',
    inputSchema: { query: z.string().min(1).max(8000), paths: z.array(z.string().max(300)).max(20).optional(), maxBytes: z.number().int().min(1024).max(32000).default(8000) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args) => {
    try {
      const result = await serial(() => context(root, { ...args, signal: abort.signal }));
      return { content: [{ type: 'text' as const, text: serializeBrief(result, args.maxBytes) }] };
    } catch {
      return { isError: true, content: [{ type: 'text' as const, text: 'DriftBrief could not verify this request. Continue with normal project search/read tools; retry after files settle.' }] };
    }
  });
  const timer = setInterval(() => { if (ownerRelease) void refresh(); else void acquire(); }, 30000); timer.unref();
  const parentPid = process.ppid;
  const parentTimer = setInterval(() => { try { process.kill(parentPid, 0); } catch (e: any) { if (e.code === 'ESRCH') void stop(); } }, 5000); parentTimer.unref();
  const stop = async () => {
    if (stopped) return; stopped = true; abort.abort();
    watcher?.close(); clearInterval(timer); clearInterval(parentTimer); if (debounce) clearTimeout(debounce);
    const deadline = setTimeout(() => process.exit(0), 1500); deadline.unref();
    await queue.catch(() => {});
    await ownerRelease?.().catch(() => {}); ownerRelease = undefined;
    await server.close().catch(() => {});
    process.stdin.pause();
    // MCP is a dedicated command; explicitly end after bounded cleanup.
    process.exitCode = 0; setTimeout(() => process.exit(0), 20).unref();
  };
  process.stdin.on('end', () => { void stop(); }); process.stdin.on('close', () => { void stop(); });
  process.stdout.on('error', () => { void stop(); });
  process.once('SIGINT', () => { void stop(); }); process.once('SIGTERM', () => { void stop(); });
  await server.connect(transport);
  server.server.onclose = () => { void stop(); };
  void acquire();
}
