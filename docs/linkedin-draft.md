I built DriftBrief: a small folder that gives coding agents compact project evidence—and shows when that evidence has become outdated.

The demo is simple:
1. Ask for the authentication code and test command.
2. Rename the module and change the script.
3. Ask again.
4. Watch the old source references get retired and the current excerpts appear.

It runs locally, needs no API key, and starts with your coding tool's MCP connection. The package doesn't modify source, rewrite commands, or silently skip tests. You can inspect its evidence and remove its integrations.

Why build this? Context and memory tools already exist. I wanted a smaller, inspectable package where freshness and overhead are explicit.

I deliberately haven't put “80% token savings” on the README. Smaller excerpts aren't the same as lower bills or better results. The repository includes the measurements, limitations, and a protocol for comparing complete tasks.

This is an early beta with adapters for Codex, Claude Code, and Cursor. Check the compatibility matrix for what has actually been exercised; automatic prompt injection remains opt-in.

[Insert public repository link after publication]
[Attach the recorded refactor demo or evidence viewer screenshot]

Feedback I'd find useful: a real task where this prevents repeated exploration—or where its overhead makes things worse.
