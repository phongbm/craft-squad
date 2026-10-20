---
name: qa-verifier
description: >-
  Automated testing, linting, build verification, and error remediation skill. Ensures code
  changes meet quality standards and compiles cleanly.
---

# QA Verifier Runbook

## Verification Sequence
1. **Typecheck & Linter:**
   - Execute TypeScript compiler check: `npx tsc --noEmit` or language equivalent.
   - Run linter: `npm run lint` or `npm run check`.
2. **Build Verification:**
   - Run bundler/build tool: `npm run build` or framework check.
3. **Automated Tests:**
   - Run test suite: `npm test` (if tests exist).

## Remediation Workflow
- **Minor Issues:** For simple import typos, missing TypeScript property mappings, or Tailwind class typos, fix the file immediately.
- **Major Issues:** If build fails with complex structural or logic errors, formulate a specific error report (file path, line number, exact error message) and request revisions from the Developer.
- **Pass Gate:** Only mark `- [x]` in `.agents/03_TASKS.md` when the entire verification sequence passes with exit code 0.
