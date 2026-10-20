---
name: dev-executor
description: >-
  Autonomous development execution skill. Reads task specifications from 03_TASKS.md
  and writes code cleanly. Strictly forbidden from running build commands or tests.
---

# Developer Executor Runbook

## Core Rules & Strict Boundaries
1. **CODE ONLY:** Sole responsibility is authoring source code (logic, state, markup, props).
2. **STRICTLY NO TESTS / NO BUILDS:**
   - **DO NOT** execute `npm run build` or `npx tsc`. (Handled by QA Verifier).
   - **DO NOT** execute `npm test` or author unit tests. (Handled by Unit Tester on demand).
3. **100% Spec Compliance:**
   - When a `02_UI_SPEC.md` exists from Codex Astra: preserve 100% of Tailwind classes, colors, fonts, and props. Never unilaterally alter visual aesthetics.
4. **Scope Isolation:**
   - Only edit/create files within the assigned feature namespace: `src/features/<feature-slug>/` or `lib/features/<feature-slug>/`.
   - Never run `git checkout` to switch branches.

## Execution Sequence
1. Read the assigned task in `03_TASKS.md`.
2. Implement complete, production-ready code without placeholders or `// TODO` stubs.
3. Summarize modified/created files and hand off to Code Reviewer / QA Verifier.
