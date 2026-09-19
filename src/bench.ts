import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { context } from './context.js';
import { atomicWrite } from './fs.js';

export async function benchmark(outputRoot: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'driftbrief-bench-'));
  await fs.mkdir(path.join(root,'src'));
  const count = 120;
  for (let i=0;i<count;i++) await fs.writeFile(path.join(root, 'src', `module-${i}.ts`), `export function calculateWidget${i}(price: number) {\n  return price * ${i + 1};\n}\n`.repeat(20));
  const tasks = [
    { query: 'calculateWidget42', relevant: 'src/module-42.ts' },
    { query: 'module 17', relevant: 'src/module-17.ts' },
    { query: 'calculateWidget98', relevant: 'src/module-98.ts' },
    { query: 'hello thanks', relevant: null }
  ];
  const samples: any[] = []; const cpuBefore = process.cpuUsage();
  try {
    for (let repeat=0;repeat<3;repeat++) for (const task of tasks) {
      const started = performance.now(); const result = await context(root, { query: task.query });
      samples.push({ repeat, ...task, elapsedMs: +(performance.now()-started).toFixed(2),
        relevantRetrieved: task.relevant === null ? result.evidence.length === 0 : result.evidence.some(e => e.path === task.relevant),
        bytes: result.footprint.bytes, estimatedTokens: result.footprint.estimatedTokens, excerpts: result.evidence.length });
    }
    const sorted = samples.map(s => s.elapsedMs).sort((a,b) => a-b);
    const cpu = process.cpuUsage(cpuBefore);
    const report = { schema: 1, generatedAt: new Date().toISOString(), node: process.version, platform: process.platform,
      fixture: { files: count, language: 'TypeScript', purpose: 'Deterministic retrieval smoke benchmark; not an agent task benchmark' },
      coldMs: samples[0].elapsedMs, p50Ms: sorted[Math.floor(sorted.length*.5)], p95Ms: sorted[Math.floor(sorted.length*.95)],
      cpuMs: (cpu.user+cpu.system)/1000, peakRssBytes: process.resourceUsage().maxRSS*1024,
      retrievalPasses: samples.filter(s=>s.relevantRetrieved).length, total: samples.length,
      agentTaskSuccess: null, providerTokens: null, billingSavings: null,
      limitations: ['Same-process measurements; cold CLI startup and idle MCP overhead are measured separately.', 'No model calls. Relevant-file retrieval is not task completion.', 'No comparison against a whole-repository dump. No claimed token savings.'], samples };
    await atomicWrite(outputRoot, '.driftbrief/reports/benchmark.json', JSON.stringify(report,null,2));
    return report;
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
