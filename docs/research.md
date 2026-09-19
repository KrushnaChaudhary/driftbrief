# Research and product decisions
Research reviewed September 19, 2026. Findings describe their specific models, harnesses and datasets, not universal effects.

| Evidence | Finding and limitation | Product decision |
| --- | --- | --- |
| [Evaluating AGENTS.md, February 2026](https://arxiv.org/abs/2602.11988) | Generated files reduced resolution in five of eight settings and increased cost on tested coding tasks. Python-focused evaluation. | Avoid generated instruction bloat. |
| [The Complexity Trap, August 2025](https://arxiv.org/abs/2508.21433) | Simple observation masking performed competitively with LLM summarization in the studied agent harnesses. A drop-in MCP cannot control native conversation history. | Deterministic retrieval; no hidden history rewriting. |
| [METR randomized trial, July 2025](https://arxiv.org/abs/2507.09089) | Experienced developers took longer with early-2025 AI tools on familiar repositories. This is not a current universal slowdown estimate. | Measure outcomes and elapsed time, not perceived speed. |
| [Agent READMEs, November 2025](https://arxiv.org/abs/2511.12884) | Context files are maintained, but additions exceed deletions. Descriptive evidence, not a causal efficiency result. | Source-bound facts and explicit invalidation. |
| [ContextSniper, July 2026](https://arxiv.org/abs/2607.01916) | Reported significant token reduction alongside slightly lower resolution; small samples and validation limitations. | No token claim without quality evaluation. |
| [JetBrains RTK benchmark, July 2026](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/) | Pinned RTK/Claude trials did not show the advertised task-cost savings. One vendor study and specific configuration. | Count complete task usage, cache effects and overhead. |
| [Historical RTK issue 827](https://github.com/rtk-ai/rtk/issues/827) | A user reported decisions based on silently truncated diffs. Closed issue, not proof of a current defect. | No interception or filtering of native command output. |
| [Claude Code memory issue 85075](https://github.com/anthropics/claude-code/issues/85075) | A user reported stale automatic memory. An individual report, not a prevalence estimate. | Visible source and observation dates. |

## Existing work

| Project | Established capability | DriftBrief boundary |
| --- | --- | --- |
| [Repomix](https://github.com/yamadashy/repomix) | Repository packing, token estimates, structural compression | Request-specific excerpts rather than a whole-repository export |
| [Aider repo map](https://aider.chat/docs/repomap.html) | Dependency-ranked symbol context within a budget | Independent local MCP integration |
| [Serena](https://github.com/oraios/serena) | Semantic navigation/editing through language intelligence | Small read-only lexical retrieval; no replacement language server |
| [RTK](https://github.com/rtk-ai/rtk) | Command rewriting and output compression | No shell rewriting |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Persistent session memory and retrieval | No transcript capture or background summarizing model |
| [AICTX](https://github.com/oldskultxo/aictx) | Repository continuity, evidence, freshness, handoffs | Narrow source retrieval and evidence inspection |
| [Stele Context](https://github.com/IronAdamant/stele-context) | Local cache, source deltas, symbol graph and worktree awareness | Simpler selected-source contract with explicit overhead |
| [Context7](https://github.com/upstash/context7) | Current external library documentation | Local project evidence only |

The ingredients are established. The intended differentiation is the combination of a portable folder, recoverable and bounded behavior, visible evidence invalidation, reversible integration and honest measurement. Popularity indicators do not establish active-user counts or effectiveness.
