# Game-agent navigation: research and scope

Reviewed 2026-09-19. H5 means HTML5/browser games here. This is a focused review of developer reports, maintained tools and engine documentation, not a representative market survey.

## The recurring problems

| Evidence | What it supports | Implementation decision |
|---|---|---|
| [Unity metadata documentation](https://docs.unity3d.com/Manual/AssetMetadata.html) and [serialized text format](https://docs.unity3d.com/Manual/FormatDescription.html) describe persistent asset IDs and scene data. | Code-only search misses serialized asset references. | Resolve scene/prefab GUID references through actual .meta files, with both files checked. |
| [Coplay's own server guidance](https://github.com/CoplayDev/unity-mcp/blob/beta/Server/src/main.py) warns about invented shader names and package-specific APIs and recommends modest pages. | Actual project assets/packages and bounded results matter. | Return real paths and declared Unity versions/packages; do not generate engine advice. |
| [Unity MCP issue 1019](https://github.com/CoplayDev/unity-mcp/issues/1019) describes client/bridge configuration failures; [issue 965](https://github.com/CoplayDev/unity-mcp/issues/965) describes a server startup failure. Historical reports, not assertions of current defects. | Setup complexity is a real failure mode. | One Node installer, stdio transport, no engine plugin or Python service. |
| [canakbass/unity-mcp](https://github.com/canakbass/unity-mcp) documents selectable groups because all tool schemas have overhead. Its numbers are maintainer measurements, not independently reproduced. | Tool discovery itself consumes context. | Expose one small map tool, default payload at most 4,000 bytes. |
| [Phaser Editor AI Chat](https://docs.phaser.io/phaser-editor/ai/chat) explicitly asks users to supply assets and scene files as context; [Phaser scenes](https://docs.phaser.io/phaser/concepts/scenes) define scene keys and switching. | Scene/loader relationships are relevant to browser-game navigation. | Resolve local imports, literal scene keys and literal asset-loader paths. |
| [Cocos metadata documentation](https://docs.cocos.com/creator/3.0/manual/en/asset/meta.html) explains UUID-based resources and missing-reference problems. | HTML5 mapping cannot mean only JS filenames. | Support exact serialized UUID references and top-level metadata UUIDs. Compressed/subasset UUID resolution remains incomplete. |
| [Epic modules](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-modules) and [Asset Registry](https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-registry-in-unreal-engine) describe separate source modules and engine asset information. | C++ source and binary assets are different information surfaces. | Map Build.cs/.uproject modules, includes, config asset paths and binary locations; do not pretend to understand Blueprint graphs without engine data. |

Developer discussion also reports setup time and context costs: [Blueprint workflow discussion](https://www.reddit.com/r/unrealengine/comments/1tjeuqg/ai_and_blueprints/) and [Unreal MCP experience](https://www.reddit.com/r/unrealengine/comments/1vw9mus/what_is_your_experience_with_thge_unreal_engine/). These are anecdotes, not quantified demand or causal evidence.

## The market already has maps

[gdep](https://github.com/pirua-game/ai_game_base_analysis_cli_mcp_tool) is a close competitor: Unity/Unreal game-code mapping, references, context and cached analysis. Its README advertises many analysis tools and Python/.NET requirements. [ZiggyMar's Unreal MCP](https://github.com/ZiggyMar/unreal-mcp) provides engine-connected Blueprint indexing and manipulation. [Phaser Editor MCP](https://docs.phaser.io/phaser-editor/ai/mcp-server) exposes editor-specific context.

Therefore DriftBrief cannot honestly claim that game-agent maps do not exist. Its narrower proposition is: one small, read-only, offline map interface across common game project files; one-command setup; no editor plugin, model call, history accumulation or build dependency.

This is useful when an agent repeatedly searches for the right script or serialized reference. It is not sufficient when the task requires live scene state or Blueprint graph semantics. Prefer an engine-connected tool for that case.

## Keep the product focused

The primary workflow is install once → agent asks for a map → agent reads the relevant files. Source reconciliation happens automatically at map requests and while the MCP host is connected. Ordinary file edits need no manual refresh commands.

Refactors/renames are verification cases, not features users must perform. The beta no longer markets historical evidence inspection. No autonomy, asset editing, conversation memory, cloud documentation service or always-running OS daemon is added.

Local fixture navigation and overhead are measured in the repository. Complete-task evaluation has a separate protocol for quality, elapsed time and provider usage.
