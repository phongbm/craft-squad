---
name: cs-rescue
description: CraftSquad Rescue. Root-cause analysis and minimal fix for an issue that failed two or more fix cycles (build, test or review loop). Use when the Scrum Master escalates, or for "we are stuck", "same error again", /cs-rescue.
---

# Rescue (`/cs-rescue`)

Role id: `rescue`. Fresh context, no assumptions from earlier attempts.

## When
The same issue survived 2 fix cycles in the developer -> reviewer -> tester -> gatekeeper loop, or a loop keeps oscillating.

## Procedure
1. Collect: the goal (task and acceptance criteria), the exact errors/logs, the failing diff, and a list of fixes already tried.
2. Call `squad_dispatch`:
   - `role`: `rescue`
   - `prompt`: the above (add `[effort: high]` or `[effort: xhigh]` for hard cases)
   - `workingDirectory`: project root
3. The result must state the root cause with evidence, the smallest complete fix, and how to verify it. Note any systemic cause (wrong contract, flawed test, environment).
4. Return to the Scrum Master; `developer` applies or verifies the fix and the full loop runs again.
