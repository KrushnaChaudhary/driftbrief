# Measurements

`game-map.json` measures Unity, Unreal, HTML5/Phaser and Cocos source-format fixtures with 80 unrelated files each, three repetitions per fixture. Expected links are declared separately from the implementation. Timings include a fresh Node process.

`runtime.json` measures CLI map startup, optional legacy hook overhead and a 35-second Windows CPU/RSS sample including scheduled reconciliation. Hooks are not the recommended game workflow.

`client-discovery.json` separates native configuration discovery from approval and actual activation. `retrieval.json` is the older beta.1 excerpt-helper result, not a game-map measurement.

Reproduce:
```sh
npm run build
node scripts/game-bench.mjs
node scripts/measure-runtime.mjs
```

These fixtures are not engine-built games or completed agent tasks. Provider usage, task success and financial savings remain unmeasured. Payload counts include map metadata, excluding transport envelopes and the tool schema.

[Validation](../validation.md) · [Opt-in evaluation](../../evals/README.md)
