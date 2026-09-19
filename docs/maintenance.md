# Maintenance policy

DriftBrief makes no runtime network calls and does not update itself. Source freshness is automatic; compatibility maintenance requires tested releases.

- Pin distributed code through versioned npm tarballs and portable ZIPs with SHA-256 checksums.
- Commit the development lockfile; ship all runtime JavaScript and parser WASM in the bundle.
- Weekly compatibility CI tests the locked dependency set on Windows/macOS/Linux and Node 22/24. Dependabot proposes dependency changes; it does not update users' projects.
- Track Codex, Claude Code and Cursor documented integration changes. Contract fixtures are insufficient evidence of native-client compatibility: run the live checklist before changing badges.
- Malformed/new hook inputs return no context, never a blocking decision. Doctor reports missing or edited integration entries and runtime assets without automatically rewriting them.
- Rebuild source-derived caches after incompatible schema updates. The v1 installer currently requires uninstall/reinitialize for changed client options or bundle versions.
- Release claims must include tested versions, machines, workload, sample count and missing results.
- Review bundled dependency notices and known-vulnerability audit output before release.
- Publish a beta until native-client and cross-platform results justify broader support claims.

To remove: uninstall integrations, restart clients, inspect preserved entries, then remove the package folder if no references remain. No operating-system service needs removal.
