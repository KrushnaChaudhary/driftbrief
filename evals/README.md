# Paired task evaluation

This is a small engineering evaluation set, not SWE-bench or a statistically sufficient universal effectiveness study. It contains ten JS/Python repair tasks plus two unrelated prompts. Each task gets twenty distractor source files.

The default command is a **dry run**, with no model usage:
```sh
node scripts/evaluate.mjs --adapter codex --model YOUR_EXACT_MODEL --dry-run
```

To explicitly spend your existing agent allowance:
```sh
node scripts/evaluate.mjs --adapter codex --model YOUR_EXACT_MODEL --effort medium --repeats 3 --allow-agent-usage
```

Claude uses `--adapter claude`. It requires a working local CLI/authentication. Python evaluation requires Python on PATH, but DriftBrief itself does not. Use a disposable local environment; validation executes the agent-edited fixture code. The runner does not bypass native sandbox/trust settings. Infrastructure, approval or authentication failures remain failures and are reported.

Both arms use the same model, effort, task and initial files. Arm order alternates deterministically by repetition. The baseline has no DriftBrief configuration; treatment explicitly registers the same bundled MCP server. Automatic hooks are not included in this first runner. The actual CLI versions, settings, exit status, elapsed time and available usage are recorded. Missing usage remains null.

The runner preserves synthetic fixture traces for inspection under `artifacts/eval-<timestamp>/`. It never reads your private conversation history. Validation comes from the canonical task definitions outside the edited fixture, so changing fixture tests cannot fake a pass. Unrelated tasks must leave source unchanged and produce the requested response.

Use repeated per-task paired results, not aggregate payload bytes, for claims. Account for failures, treatment activation, cached versus uncached input, task success, elapsed time and model version. Inspect traces to confirm the agent used DriftBrief. A smaller tool response alone is not a saving.

Before enabling automatic hooks by default, add a separate hook treatment arm with recorded activation and native trust. Before broader public claims, expand to representative real tasks/repositories and repeat trials. Keep an observed quality regression visible; do not hide it behind token reduction.

The code is provided for explicitly invoked, complete-task evaluation using your existing agent allowance.
