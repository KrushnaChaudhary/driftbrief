# Client setup and coverage

DriftBrief uses a single stdio MCP map tool.

| Client | Setup |
|---|---|
| Codex CLI 0.154.0-alpha.6.2 | Run `node .driftbrief/run.mjs launch codex` to supply project MCP settings for the current session |
| Codex clients with project MCP configuration | Initialization writes .codex/config.toml; follow the host's project trust flow |
| Claude Code | Initialization writes .mcp.json; approve the project server in Claude and restart |
| Cursor | Initialization writes .cursor/mcp.json and a small discovery rule; enable the server in Cursor's MCP settings |

The scoped Codex launcher addresses the tested alpha's project configuration behavior and preserves global settings. Native trust and server enablement are controlled by each coding client.

## Verification surfaces

Configuration lifecycle tests cover all three adapters. The official MCP SDK exercises discovery, map calls, source refresh, concurrent clients and connection closure. Native discovery observations are retained in [diagnostics](measurements/client-discovery.json).

The [CI matrix](https://github.com/KrushnaChaudhary/driftbrief/actions) targets Windows, macOS and Linux on Node 22 and 24. [Local results](validation.md) identify the machine and checks used.

## Operational scope

Use Node 22 or 24 on the project's machine. Local filesystems are the primary target. Runtime and root paths are absolute, so moving a project or Node installation requires reinitialization.

Map coverage is based on static project files. Binary asset entries describe path/existence; engine-connected tools provide live editor and Blueprint graph details. Optional hooks remain an explicit experimental setting.

[Codex MCP](https://learn.chatgpt.com/docs/extend/mcp) · [Claude MCP](https://code.claude.com/docs/en/mcp) · [Cursor MCP](https://cursor.com/docs/mcp)
