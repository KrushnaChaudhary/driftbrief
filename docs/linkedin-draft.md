AI can help plan a game system and build its foundation.

But before it does that, it needs to understand the game it is joining.

Where does this feature live?
Which scene uses this prefab?
Which script drives it?
What existing system should the new code connect to?

That is what I am building DriftBrief for.

A small, automatically updated project map for coding agents—so the architecture they propose and the code they scaffold can start from the actual project.

One installation command. One map tool. A compact response instead of a giant context dump.

The interface stays the same across engines; the connections underneath are engine-specific:
• Unity: scripts, prefabs, scenes and GUID references.
• Unreal: modules, source relationships and asset locations.
• HTML5: imports, scene transitions and asset paths, including exact Cocos UUID links.

It runs locally, requires no API key or editor plugin, and does not edit the game.

It is an early beta. Binary Blueprint internals and live editor state are outside this version, and I am measuring usefulness before claiming time or token savings.

[Add repository link after publication]
[Attach the game-map demo]

Planning to add Godot next.
