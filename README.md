# DriftBrief
**Give your coding agent a compact brief, checked against your current source.**

Drop in a folder, initialize it once, and use it from your coding tool. DriftBrief retrieves relevant source excerpts, records where they came from, and shows when older evidence no longer matches.

**v0.1.0-beta.1 · local · no account or API key · Node.js 22 or 24**

[Recorded walkthrough](docs/demo/walkthrough.html) · [Evidence viewer](docs/demo/evidence.html) · [Compatibility](docs/compatibility.md) · [Measurements](docs/measurements/README.md)

## See the point

Rename a module or change a test script. The next request reads current files, retires the older receipt's evidence, and returns the updated source. Inspect the selected lines, selection reasons, source fingerprints, and omissions in an offline HTML report.

This is a retrieval assistant, not a replacement coding agent. It does not modify your source, rewrite shell commands, skip tests, or call a model.

## Install the portable folder

Extract the portable ZIP into your project so it contains `.driftbrief/run.mjs`, then run:

```sh
node .driftbrief/run.mjs init --clients codex,claude,cursor
```

Restart the selected clients and accept their normal project/MCP trust prompts. The installed Codex alpha build did not load project-local MCP configuration in discovery checks. For affected Codex CLI builds, use the scoped launcher: `node .driftbrief/run.mjs launch codex`. It supplies configuration for that invocation without changing global settings. Desktop activation on affected builds remains unverified. Configuration uses absolute local paths: after moving a project or Node installation, uninstall and initialize again. Existing user settings are preserved.

The MCP process starts with the client connection and stops when it closes. No operating-system service, global configuration change, or background model call is installed.

Automatic prompt hooks are **experimental and off by default**. MCP retrieval works without them. For an explicit trial, add `--hooks` during initialization. Changing installation options requires uninstalling first.

## Use it

Your agent can call the single MCP tool `context({ query, paths?, maxBytes? })`. Cursor receives a small dedicated discovery rule; Codex and Claude receive the MCP tool description. Automatic hooks, when explicitly enabled, are available in Codex and Claude.

```sh
node .driftbrief/run.mjs context "authenticate user and test command"
node .driftbrief/run.mjs context "invoice total" --paths src,tests --max-bytes 4000
node .driftbrief/run.mjs inspect --html
node .driftbrief/run.mjs doctor
node .driftbrief/run.mjs uninstall
```

Commands accept `--root <project>`. Context output is compact JSON. The default payload limit is 8,000 UTF-8 bytes; hooks cap the entire JSON response at 4,000 bytes. Token estimates use bytes divided by four and are **not provider usage or savings**.

After uninstall, restart clients. Local evidence and the runtime remain in `.driftbrief/` for recovery; remove that folder once no preserved integration references need it. User-modified configuration entries are retained and reported.

## What it understands

- JavaScript, TypeScript, TSX and Python symbols through bundled Tree-sitter WASM parsers.
- Explicit npm scripts, package manager declarations, and declared dependency ranges.
- Python entrypoints, declared dependencies and pytest test paths from `pyproject.toml`.
- Other languages as searchable UTF-8 text, with incomplete parsing disclosed.

It never executes `setup.py`, imports project modules, or guesses that a Python entrypoint is a test command.

## What “checked” means

Source excerpts are re-read and hashed when served. Watchers only accelerate refresh; MCP queries reconcile files themselves. A changed or unreadable candidate is omitted. Hooks use a smaller cached index and disclose best-effort coverage.

A hash proves which bytes were observed, not semantic correctness or complete retrieval. Files can change afterward; existing AI conversation text cannot be retracted. Native file reads remain available.

Git exclusions and `.driftbriefignore` apply. Dependency/generated folders, binary/large files, credential paths, symlinks and detected secrets are excluded. Secret detection is heuristic. Local indexes and evidence reports may contain proprietary project information. Selected excerpts pass through your existing AI client and its data handling.

## Status and honest limits

The official MCP SDK transport, parser assets, configuration lifecycle, freshness and failure paths are tested locally on Windows/Node 24. CI covers Windows/macOS/Linux on Node 22/24 when run. Native-client discovery checks and outstanding live-validation gaps are listed in [compatibility](docs/compatibility.md).

**No task-level speedup or token savings have been established.** The [research](docs/research.md) is why task-quality evaluation comes before marketing percentages. Automatic hooks remain opt-in.

V1 bounds: 5,000 eligible files, 32 MiB of source per reconciliation, 512 KiB per file, 40 receipts, three published index generations. Limits and parser failures appear as omissions. Local filesystems are supported; network/virtual mounts are best effort.

## Build and package

```sh
npm ci --ignore-scripts
npm run check
npm run demo
npm run bench
npm run release:local
```

Build output includes `run.mjs`, bundled parser assets, third-party notices and a dependency inventory. The npm package and portable ZIP need no runtime npm dependencies. Release files are generated under `release/`, with SHA-256 checksums. The package has not been published to npm by this build.

[Architecture](docs/architecture.md) · [Maintenance](docs/maintenance.md) · [Evaluation protocol](evals/README.md) · [LinkedIn draft](docs/linkedin-draft.md)

MIT licensed. No telemetry, self-updater, or cloud service.
