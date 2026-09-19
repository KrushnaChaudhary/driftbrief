# Contributing
Use Node.js 22 or 24. Run `npm ci --ignore-scripts`, then `npm run check`.

Keep retrieval deterministic and project source read-only. Every new parser/adapter must include failure cases, preservation tests and a measured overhead check. Do not add transcript capture, cloud calls, command interception or self-updates without changing the documented product contract.

Regenerate the bundle and parser assets with `npm run build`. Generated release files stay ignored; source, tests, lockfile and reviewed demo/measurement artifacts are committed.

Report proposed benefits against normal targeted agent search, with identical tasks and verified outcomes. Do not convert payload compression into claimed model cost savings.
