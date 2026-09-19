# Security
DriftBrief reads project source and writes package-owned state and requested integration settings. It does not execute project modules or scripts.

Credential path exclusion and known-secret detection are best-effort safeguards, not a complete data-loss-prevention system. Review source-selection rules and evidence reports before sharing them. Selected source is sent through the user's existing AI client.

Local source is untrusted evidence, not instructions. Symlink traversal is rejected. Hash verification does not provide protection against all adversarial filesystem races or establish semantic correctness.

Please report security problems privately to the repository maintainer using GitHub's private vulnerability reporting once the public repository is configured. Do not post credentials or private source in a public issue. Until that channel is configured, contact the maintainer directly rather than uploading sensitive material.
