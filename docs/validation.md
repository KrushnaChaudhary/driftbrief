# Local beta validation

Validated on 2026-09-19 using Windows and Node.js 24.14.0.

| Check | Result |
|---|---|
| TypeScript strict check | Passed |
| Automated suite | 25 passed, zero failed or skipped |
| Freshness | Edits, additions, rename, deletion, branch/worktree changes, same-size/same-time changes, and changes between ranking/reading exercised |
| Isolation and failure | Concurrent MCP hosts, stale writer locks, corrupt/unpublished cache, EOF shutdown, symlink rejection, and source/Git-index preservation exercised |
| Installation | All adapter configuration contracts, idempotence, malformed input rollback, user edits, and tampered-target rejection exercised |
| Official MCP SDK | Discovery, invocation, source refresh, concurrent hosts and closure passed |
| Offline viewer | Desktop/mobile navigation, no overflow, no external requests and no JavaScript errors |
| Deterministic retrieval benchmark | 12/12 fixture checks; task success and provider savings unmeasured |
| Dependency audit | npm audit reported zero known vulnerabilities at validation time |
| Portable archive | Extracted without node_modules; init, parser-backed retrieval, doctor and integration removal passed |
| Native clients | Codex scoped CLI configuration discovery passed; project configuration ignored by tested alpha. Claude entry pending native approval. Cursor session not exercised. |
| Cross-platform matrix | Six CI combinations configured; remote runs not yet performed |
| Agent comparison | Reproducible dry-run harness prepared; no model-consuming trial performed |

Raw timings are in [measurements](measurements/README.md). Client status is in [compatibility](compatibility.md).

The recording is an actual scripted CLI demonstration replay (HTML and asciinema), not a recording of an AI agent completing a task. It demonstrates current-source retrieval and retirement of historical evidence.

The repository and release archives are local preparations. No GitHub remote, npm publication, or LinkedIn post was created. Recheck the provisional package name before publishing.
