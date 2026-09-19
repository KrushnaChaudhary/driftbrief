# Compatibility
Status: September 19, 2026. “Adapter implemented” is not the same as an end-to-end verified native-client workflow.

| Surface | Implementation | Verification |
| --- | --- | --- |
| Codex | Project TOML MCP registration; opt-in UserPromptSubmit hook | Configuration lifecycle and hook contract tested; native discovery check recorded separately below |
| Claude Code | Project .mcp.json; opt-in settings hook | Configuration lifecycle and hook contract tested; native discovery check recorded separately below |
| Cursor | Project MCP registration and dedicated .mdc discovery rule | Configuration lifecycle tested; native Cursor session pending |
| MCP protocol | Official SDK stdio server, one map tool | Actual SDK client initializes, lists/invokes tool, waits idle, observes edits, closes |
| Windows / Node 24.14 | Build, parsers, retrieval, lifecycle, release | Locally exercised |
| Windows / Node 22 | CI configured | CI result pending |
| macOS / Node 22 and 24 | CI configured | CI result pending |
| Linux / Node 22 and 24 | CI configured | CI result pending |

## Observed native-client results

Codex CLI 0.154.0-alpha.6.2 did not expose the generated project MCP entry through `mcp get` or the read-only app-server config probe, including the trusted fixture probe. Do not treat this installed build as verified for automatic project-local activation. The scoped fallback `node .driftbrief/run.mjs launch codex` supplies MCP settings for the current CLI invocation and leaves global configuration unchanged. Its native discovery result is recorded in the diagnostic JSON. This does not establish desktop-client activation.

Claude Code 2.1.246 discovered the project entry and reported **Pending approval**. No approval bypass or model call was used. Cursor native validation remains pending.

## Native trust and restarts

- Codex project MCP/hooks load only with the host's project trust. [Official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp) and [hooks](https://learn.chatgpt.com/docs/hooks).
- Claude project MCP definitions need native approval; an unapproved server can appear as pending without connecting. [Official MCP documentation](https://code.claude.com/docs/en/mcp) and [hooks](https://code.claude.com/docs/en/hooks).
- Cursor has its own MCP enablement/approval settings. The first release uses agent-invoked MCP rather than assuming prompt injection parity. [MCP](https://cursor.com/docs/mcp), [rules](https://cursor.com/docs/rules), [hooks](https://cursor.com/docs/hooks).

The installer does not bypass native approvals. Restart clients after installation or removal. Do not advertise “fully tested in all three clients” until actual discovery, invocation, source refresh and removal have been recorded in each native host.

## Known limitations

- Absolute runtime/root paths require reinitialization after relocation.
- Node 22 or 24 is required on the same machine as the local project and client.
- Source parsing has declared syntax limits; unsupported/dynamic constructs use text fallback.
- Network mounts, unusual virtual filesystems, adversarial filesystem races and forced process termination are not universally guaranteed.
- A user-edited .driftbrief/.gitignore is preserved. Review ignored state if changing it.
- The hooks are experimental. Native model usage/time/quality improvements have not been measured.

Native discovery observations will be saved in `docs/measurements/client-discovery.json` when available; pending approval is not counted as a successful connection.
