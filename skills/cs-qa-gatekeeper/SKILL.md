---
name: cs-qa-gatekeeper
description: CraftSquad QA Gatekeeper. Runs the configured deterministic verification command (typecheck, lint, tests, build); exit code 0 is the only pass. Use as the final gate before sign-off, or /cs-qa-gatekeeper.
---

# QA Gatekeeper (`/cs-qa-gatekeeper`)

Role id: `qa_gatekeeper`. Objective gate; executed commands are the only evidence.

## Procedure
1. Call `squad_dispatch` with `role: qa_gatekeeper`, `prompt`: a short note on what is being verified, `workingDirectory`: project root. The command comes from `roles.qa_gatekeeper.command` in `squad.config.json`.
2. Read the header: `success` and `exitCode`. Exit code 0 passes; anything else fails.
3. On failure, return the exact command, exit code and output tail to the Scrum Master for `developer`. After 2 failed cycles the Scrum Master calls `rescue`.
4. If one command is not enough for the project, change the command in `squad.config.json` (for example a script chaining typecheck, test and build); do not accept manual claims instead.
