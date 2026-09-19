# Measurements

Raw results are included in this directory. They are local engineering measurements, not proof of AI task acceleration.

- `runtime.json`: five fresh CLI process timings, five advisory hook timings, a 35-second Windows process CPU/RSS sample including scheduled reconciliation, and state size on a 30-file fixture.
- `retrieval.json`: 12 retrieval checks (four synthetic queries, three repetitions) on 120 TypeScript files.
- `client-discovery.json`: available native-client configuration discovery; pending approval is explicitly distinguished from a connected server.

The latest runtime sample includes process startup in CLI/hook timings. A zero CPU delta means none was recorded at the operating system's sampling resolution over that short interval, not zero resource consumption.

No agent/model calls were used for these results. Provider input/output/cached tokens, billing and task success remain unmeasured. The recording's payload bytes include evidence metadata, but exclude transport envelopes and tool-schema overhead.

Reproduce with:
```sh
npm run build
node run.mjs bench
node scripts/measure-runtime.mjs
```

For task-level comparisons, follow [the paired evaluation protocol](../../evals/README.md). Do not compare these payloads against a hypothetical whole-repository dump and call the difference money saved.
