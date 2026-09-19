# Measurements

`game-map.json`: Unity, Unreal, HTML5/Phaser and Cocos source-format fixtures with 80 distractors each, three repetitions and expected relationships defined separately from the implementation.

`runtime.json`: CLI map startup, optional hook overhead, actual tool-discovery payload and a 35-second Windows CPU/RSS sample including scheduled reconciliation.

`client-discovery.json`: captured native configuration diagnostics.
`retrieval.json`: the earlier excerpt-helper benchmark.

Reproduce:
```sh
npm run build
node scripts/game-bench.mjs
node scripts/measure-runtime.mjs
```

Timing includes process startup where indicated. Byte counts cover the map payload; transport envelopes and tool schemas have separate costs. Token counts are estimates. Complete-task evaluation has its own [opt-in protocol](../../evals/README.md).

[Validation](../validation.md)
