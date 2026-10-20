---
name: dev-executor
description: >-
  Autonomous development execution skill. Reads task specifications from .agents/03_TASKS.md
  or .agents/features/<slug>/03_TASKS.md and implements code strictly following architecture and design guidelines.
---

# Developer Executor Runbook

## Core Rules & Physical Concurrency
1. **Directory Isolation:** Confine all code changes strictly to the feature namespace: `src/features/<feature-slug>/` or specified isolated component files.
2. **Never Jump Branches:** Do NOT attempt to run `git checkout` or change git branches. Work strictly within the files assigned.
3. **Strict Spec Compliance:** Never invent alternative component names or props. Follow `02_UI_SPEC.md` 1:1.
4. **No Placeholders:** Avoid `// TODO` or truncated code snippets. Write complete, working code.
5. **Clean Code:** Adhere to project linting, TypeScript strict mode, and CSS/Tailwind standards.

## Execution Checklist
1. Read the assigned task from `03_TASKS.md`.
2. Inspect referenced types and existing components to ensure compatibility.
3. Apply changes using precise file operations within the feature folder.
4. Summarize created/modified files for the QA Verifier.
