---
name: cs-tester
description: CraftSquad Tester. Maps every acceptance criterion to executable tests, closes verification gaps found in review, runs them and reports real results. Use after code review passes, or for "write tests for this", "verify the acceptance criteria", /cs-tester.
---

# Tester (`/cs-tester`)

Role id: `tester`. Proves behaviour with tests; never edits feature code to make tests pass.

## Procedure
1. Collect: acceptance criteria, changed files, reviewer verification-gap findings, the project's test conventions.
2. Call `squad_dispatch`:
   - `role`: `tester`
   - `prompt`: the above, plus the required output
   - `artifactType`: `checklist` (verification checklist)
   - `workingDirectory`: project root
3. Make sure tests are actually run and real pass/fail output is reported; no "pass" without execution.
4. Output the checklist: criterion -> test -> result. Defects go back to the Scrum Master for `developer`.

Engine, model and effort come from `squad.config.json`.
