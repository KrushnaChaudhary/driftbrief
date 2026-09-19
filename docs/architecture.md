# Architecture

DriftBrief helps an agent understand an existing game before planning or building a system. It maps where project pieces connect; the agent handles reasoning and implementation.

## One interface, engine-specific facts

Client → one stdio MCP tool `map` → bounded file reconciliation → relationship resolution → focused selection → selected-source verification → compact JSON.

A blank query returns an overview. A feature, class or scene query selects relevant paths and expands at most two relationship hops. Up to 50,000 relationships are resolved locally. Default output is 4,000 bytes, including metadata; configurable range 1,500–12,000.

The result contains engine hints, coverage, directory areas, selected nodes, reference locations, verified source hashes and omissions. UTF-8 bytes/4 is only a token estimate.

Unity resolves GUIDs through .meta files. Cocos resolves exact UUIDs through top-level JSON metadata. C#/C++ declaration and include adapters are lexical, not compiler analysis. Unreal modules and /Game path strings resolve to real files. JS/TS imports, Phaser literal scene keys and asset paths resolve only when unambiguous.

Binary assets are path/existence-only nodes. No Blueprint graph or live editor state is inferred. Dynamic paths, aliases, external packages and Cocos compressed/subasset UUIDs may be unresolved. Godot is planned, not supported by a dedicated adapter yet.

## Small and fresh

Each map request reconciles eligible files and hashes the bounded text inventory; unchanged hashes reuse parsed data. Git identity/HEAD stability is checked. Selected source and supporting metadata are read again before delivery. Changed or unavailable evidence and its dependent links are omitted.

A single background owner debounces watcher hints and reconciles every 30 seconds while connected. Queries remain usable from other clients. Distinct ownership/publication locks expire after missed heartbeats. Complete index generations are immutable and the current pointer is replaced atomically.

Bounds: 5,000 text files, 32 MiB text, 512 KiB per file, approximately 12 MiB document index; 5,000 opaque paths within 512 KiB; three generations. Metadata IDs do not create bulky keyword indexes. Map queries save no prompts, transcripts or evidence receipt history.

The legacy CLI excerpt/inspection helpers remain for diagnostic compatibility but are not registered as agent tools. Experimental hooks are off by default and outside the recommended game-map workflow.

## Protection and installation

Mapping writes only package-owned state. Engine build caches, dependencies, credentials, binary contents and escaping symlinks are excluded. Secret detection precedes source-derived persistence. Existing agent instructions remain under their native client's handling.

The offline installer temporarily extracts its embedded runtime, invokes validated initialization, and cleans up. Only Node 22/24 is required. Configurations are parsed before owned changes, with original bytes recorded for recovery. No engine compilation, project script or model is executed.

Uninstall restores unchanged originals or removes exact owned entries, preserving user edits. Runtime files remain for recovery. Native trust prompts remain native. Stdio closure and termination cancel work and stop watchers with bounded cleanup.

An observed hash is not semantic correctness; files can change afterward. Forced termination, adversarial filesystem races and virtual mounts are not universally guaranteed.
