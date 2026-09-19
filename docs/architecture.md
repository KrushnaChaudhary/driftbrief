# Architecture and contracts

## Data flow

Client → stdio MCP → reconcile eligible files → deterministic ranking → verified excerpts → bounded JSON receipt.

Codex/Claude optional prompt hooks → bounded compact index → source re-read → advisory additional context. Hook failure returns no output, with exit zero.

Sources are data, not behavioral instructions. Existing AGENTS/CLAUDE files remain managed by their native clients and are excluded from retrieval.

## Index and ranking

Git enumeration uses NUL-separated paths, includes eligible untracked files, and disables optional Git locks and external filesystem-monitor commands per invocation. Non-Git projects use bounded traversal and nested ignore rules. Package exclusions apply even to tracked secrets.

Each eligible file is read within a size cap. Reads check file identity, size and modification metadata around the operation. Known-secret detection runs before any source-derived state is persisted. SHA-256 identities support reuse of parsed symbols and term frequencies. Tree-sitter parses JS/TS/TSX/Python without loading project modules. Other source uses text retrieval.

Ranking combines term frequency/inverse document frequency, path matches, symbol matches and explicit path hints. Strong matches and rare query terms are favored; at most six candidates are selected. This is lexical retrieval, not an embedding service or full semantic reference graph.

## Freshness

An MCP query rebuilds the eligible inventory and hashes its bounded source set. It verifies HEAD stability across reconciliation and re-reads selected files before emitting excerpts. A candidate changed between ranking and reading is omitted. Receipts record source verification independently from index reconciliation.

Hook snapshots are deliberately smaller and may omit files. They validate worktree/commit identity and candidate hashes, but do not claim current retrieval coverage. The hook processing target is 250 ms; a 500 ms internal watchdog and two-second host timeout bound failure behavior. Node startup and operating-system scheduling are outside the internal processing target.

The previous retained receipt is checked for changed/missing sources on a new normal query. The offline viewer rechecks every retained receipt at report generation. These are historical comparisons, not modifications to the agent's conversation.

## State and ownership

Runtime data lives under `.driftbrief/state/`. A canonical root plus resolved Git directory identifies each worktree. Complete index generations are immutable; a current pointer is atomically replaced after writing. Up to three generations and forty receipts are retained. Index data is bounded to approximately 12 MiB per full generation and 1 MiB per compact generation.

Short publication locks and long-lived background ownership use distinct lock targets. Locks expire after ten seconds without their two-second heartbeat. Lock compromise stops publishing/ownership. Queries can independently reconcile while another client owns background refresh.

The background owner watches changes with a 500 ms debounce and reconciles every thirty seconds. EOF, broken stdout, termination or detected parent death cancels work, closes watchers, releases locks and ends the process. Cleanup has a 1.5-second fallback deadline. Arbitrary forced termination and inherited handles cannot be guaranteed on every platform.

## Installation

All target configurations are parsed and collision-checked before mutation. JSON modifications preserve unrelated settings; Codex TOML receives a namespaced block. Original bytes and owned values are recorded locally. A failed installation rolls back unchanged applied configuration. Conflicting user edits are not overwritten.

Uninstall restores original bytes when a configuration is unchanged. Otherwise it removes exact owned JSON entries or an exact TOML block, preserving modified values. Runtime files and receipts remain for recovery. Backups may include private configuration values and are ignored by the package's internal .gitignore.

## Public interfaces

`context({query, paths?, maxBytes?})` is the only MCP tool. Query: 1–8,000 characters; at most 20 path hints; payload budget: 1,024–32,000 bytes (default 8,000).

The JSON result contains schema version, receipt ID, observation time, reconciliation time, coverage, evidence, omissions, invalidations and footprint. Each excerpt contains a relative path, line bounds, text, SHA-256, verification time, selection reasons and relevant manifest facts.

The payload size counts its own metadata. Estimated tokens are bytes/4, independent of any provider tokenizer. MCP transport envelopes and tool schemas add further host overhead and are not included in that payload counter.

CLI commands: init, context, mcp, launch codex, status, doctor, inspect, bench, uninstall. Internal hook command is an advisory adapter entrypoint.
