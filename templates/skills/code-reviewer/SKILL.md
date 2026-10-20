---
name: code-reviewer
description: >-
  Code Review & Audit skill. Inspects code changes against PRD, UI Spec (Astra fidelity),
  clean code practices, and security before verification.
---

# Code Reviewer Runbook

## Review Checklist
1. **UI Fidelity:**
   - Compare code diff with `02_UI_SPEC.md`.
   - Verify that the Developer has not altered colors, border radius, spacing, or responsive breakpoints defined by Astra.
2. **Clean Code & Robustness:**
   - Check null/undefined handling and API error management.
   - Ensure no leftover console logs, dead code, or placeholder comments.
3. **Security:**
   - Verify no hardcoded secrets, API tokens, or insecure credentials.

## Review Output Format
- **If PASS:**
  > `[REVIEW PASS]: Code complies 100% with UI Spec and Clean Code guidelines. Ready for QA Verifier.`
- **If REJECT:**
  > `[REVIEW REJECT]: The following issues must be resolved:`
  > 1. `File A, line X`: Deviates from UI Spec (expected `bg-indigo-600`, got `bg-blue-500`).
  > 2. `File B, line Y`: Missing try/catch block for async API call.
