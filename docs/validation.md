# Local beta validation

Validated on 2026-09-19, Windows, Node.js 24.14.0. Current version: 0.1.0-beta.2.

| Check | Result |
|---|---|
| Strict TypeScript | Passed |
| Automated tests | 36 passed; zero failed/skipped |
| Unity navigation | Scene → prefab → C# via verified metadata; ambiguous GUIDs omitted |
| Unreal navigation | Project modules, headers, config → opaque level path |
| HTML5 navigation | Local imports, Phaser scene transitions and literal asset paths |
| Cocos navigation | Exact top-level UUID references |
| Map freshness | New wiring/deletion without watcher events; source/metadata change between selection and delivery |
| Bounds/privacy | Response caps including provenance; engine caches/credentials/symlink escapes excluded; no query or map receipt persistence |
| Game benchmark | 12/12 checks on four declared source-format fixtures with 80 distractors, three repetitions |
| MCP lifecycle | Single map tool, real SDK invocation, concurrent clients and EOF cleanup |
| Configuration | Preserve existing settings; initialize twice; reject malformed input; preserve user-modified entries during uninstall |
| One-command installer | Offline self-contained installer and portable archive checked separately by release smoke scripts |
| Demo | All four game examples; desktop/mobile navigation; zero external requests or JavaScript errors |
| Native clients | Codex CLI scoped discovery works, project settings ignored by tested alpha. Claude entry needs native approval. Cursor live activation pending. |
| Cross-platform | Six Node/OS CI combinations configured; not yet run remotely |
| Agent quality/savings | Unmeasured; no model-consuming evaluation run |

[Raw measurements](measurements/README.md) and [compatibility limits](compatibility.md) are part of the release.

The fixtures exercise serialized source formats, not full engine builds or completed gameplay tasks. Map candidates are not a semantic call graph. Binary Blueprint internals are not parsed.

The self-contained installer requires Node 22/24. Client restarts/native trust remain necessary. An older or modified installation is not silently overwritten; upgrades currently require removal of the prior runtime after clean integration uninstall.

No GitHub remote, npm publication, or LinkedIn posting was performed. Registry availability must be rechecked before publication.
