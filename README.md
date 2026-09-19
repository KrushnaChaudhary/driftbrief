# DriftBrief
**Help AI understand how your game fits together before it starts building.**

AI can help plan systems and scaffold their foundations. DriftBrief gives it a compact map of the existing game to build on. Unity, Unreal and HTML5 projects connect code to scenes, prefabs and assets. DriftBrief helps an agent find those connections and choose which files to read. It refreshes automatically and exposes **one MCP tool**, with a **4 KB default response budget**.

Local · MIT · Node.js 22 or 24 · no model calls · no editor plugin

## Install once, with one command

Download the self-contained `driftbrief-install.mjs` release file. From your game project's root, run:

```sh
node /path/to/driftbrief-install.mjs
```

That installs the bundled runtime into `.driftbrief/`, builds the index and configures Codex, Claude Code and Cursor. There is no archive extraction, npm install, Python, engine compilation or project dependency change. Restart your client and accept its native trust prompt.

If you already dropped the portable `.driftbrief/` folder into the project, the command is simply:

```sh
node .driftbrief/run.mjs init
```

Optional: append `--clients claude,cursor` to select clients. Running installation twice preserves settings. The npm tarball is also prepared; the name has not been published, so no public `npx driftbrief` command is advertised yet.

**Client caveat:** the tested Codex alpha ignores project-local MCP settings. Its CLI can use `node .driftbrief/run.mjs launch codex`; automatic desktop activation is not verified. Claude requires its native approval. Cursor's configuration is tested, but a live Cursor session is pending. See [compatibility](docs/compatibility.md). Installation cannot bypass the host's trust or fix an unsupported host integration.

## The agent's workflow

```text
map()                           → small project overview
map({ query: "PlayerMovement" }) → related scenes, prefabs, scripts and assets
```

The agent then reads the relevant paths through its normal tools. The map is not pasted into every prompt. Existing instructions stay under the client's control. No new manual workflow is required when you edit files.

| Project | Map coverage |
|---|---|
| Unity | Scene/prefab → asset/script references resolved through .meta GUIDs; C# type names and base-type candidates; assemblies; declared Unity/package versions |
| Unreal | .uproject modules, Build.cs dependencies, local header candidates, /Game asset paths in source/config, level and asset filenames |
| HTML5 / Phaser | Local JS/TS imports, literal scene transitions and asset-loader paths; package versions |
| Cocos Creator | Exact UUID links from serialized scene/prefab JSON through top-level .meta UUIDs |
| Other browser engines | JS/TS imports and literal paths; Pixi, Three, Babylon and Laya package detection, with no invented scene graph |

Unity/Cocos adapters are bounded lexical format readers. Unreal binary Blueprint graphs, Cocos compressed/subasset UUIDs, dynamic loaders, compiler aliases and live editor state are not fully resolved. Ambiguous or missing targets are reported, not guessed. No complete call graph is claimed.

## Small and current

- One agent tool; 4,000-byte default map, including provenance and omissions. Optional maximum: 12,000 bytes.
- Two bounded relationship hops around a query; no whole-project dump.
- Watchers refresh while the MCP connection lives. Each map request also reconciles eligible files and checks selected text hashes, so missed watcher events do not preserve stale selected links.
- Unity Library/Temp and Unreal Binaries/Intermediate/Saved/DerivedDataCache are excluded, alongside dependencies, generated output, credential files and symlink escapes.
- Metadata IDs are indexed without bloated source-keyword lists. Ordinary maps save no prompts, transcripts or receipt history.
- No network, model, self-update, source edit, script execution, or operating-system service. Closing the client stops the MCP worker.

An observed hash establishes source bytes at a time, not semantic correctness. Binary nodes report paths/existence only. A file may change after verification. Secret detection is heuristic; local state can contain project names and identifiers.

Bounds: 5,000 text files, 32 MiB text budget, 512 KiB per text file; up to 5,000 opaque asset paths within 512 KiB metadata; three index generations. Coverage limits are visible.

## Inspect or remove

```sh
node .driftbrief/run.mjs map "PlayerMovement"
node .driftbrief/run.mjs doctor
node .driftbrief/run.mjs uninstall
```

Uninstall removes unchanged owned integration entries and preserves user edits. Restart clients, then remove the runtime folder if no preserved entry needs it. Runtime paths are absolute; relocation requires reinitialization. Background operation never changes game files or the Git index.

## Engine direction

One map interface, engine-specific connections underneath. Current coverage targets Unity, Unreal and HTML5; it does not claim complete understanding of every engine. **Planning to add Godot next.** See the [focused roadmap](docs/roadmap.md).

## Evidence and development

[Game map demo](docs/demo/map.html) · [Market research](docs/game-market-research.md) · [Measurements](docs/measurements/README.md) · [Validation](docs/validation.md)

```sh
npm ci --ignore-scripts
npm run check
npm run demo
node scripts/game-bench.mjs
npm run release:local
node scripts/check-one-step.mjs
```

No agent-level speedup or token savings have been established. Fixture navigation checks are not completed gameplay tasks. The optional paid-agent evaluation harness remains separate, and automatic prompt hooks remain experimental/off.

Version 0.1.0-beta.2. Local beta archives are prepared; publication and full native-client/cross-platform validation remain separate release gates. [Architecture](docs/architecture.md) · [Maintenance](docs/maintenance.md) · [LinkedIn draft](docs/linkedin-draft.md)
