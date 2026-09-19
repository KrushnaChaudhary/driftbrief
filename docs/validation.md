# Validation record

Version 0.1.0-beta.2. Local verification: 2026-09-19, Windows, Node.js 24.14.0.

| Check | Result |
|---|---|
| Strict TypeScript | Passed |
| Automated suite | 36 passed |
| Game-map benchmark | 12/12 expected-relationship checks passed |
| Unity | Scene, prefab and C# links through current metadata |
| Unreal | Modules, headers and configured level paths |
| HTML5 / Cocos | Imports, scene transitions, asset paths and exact UUID references |
| Freshness | Added/changed/deleted sources, dropped watcher hints and mid-request metadata changes |
| Configuration | Repeat installation, existing settings, malformed input handling and user edits |
| Lifecycle | Concurrent MCP clients, stale locks, corrupted cache and EOF cleanup |
| Installer | Standalone installer twice; portable archive; map retrieval and clean integration removal |
| Demo | Four examples, desktop/mobile layouts and offline loading |
| Dependency audit | Zero reported vulnerabilities at verification |

[All six CI jobs passed](https://github.com/KrushnaChaudhary/driftbrief/actions/runs/35457536612): Windows, macOS and Linux on Node 22 and 24. [Client setup](compatibility.md) covers native activation.

The game checks use reproducible source-format fixtures with independently declared expected links. Timing and byte measurements describe those workloads. The optional evaluation harness records provider usage and complete-task outcomes when explicitly run.

[Repository](https://github.com/KrushnaChaudhary/driftbrief) · [Releases](https://github.com/KrushnaChaudhary/driftbrief/releases) · [Map demo](https://krushnachaudhary.github.io/driftbrief/)
