---
name: dev-executor
description: >-
  Autonomous development execution skill. Reads task specifications from .agents/03_TASKS.md
  and implements code strictly following architecture and design guidelines.
---

# Developer Executor Runbook

## Core Rules
1. **Scope Discipline:** Only edit or create files specified in the active task.
2. **Strict Spec Compliance:** Never invent alternative component names or props. Follow `02_UI_SPEC.md` 1:1.
3. **No Placeholders:** Avoid `// TODO` or truncated code snippets. Write complete, working code.
4. **Clean Code:** Adhere to project linting, TypeScript strict mode, and CSS/Tailwind standards.

## Execution Checklist
1. Read the assigned task from `.agents/03_TASKS.md`.
2. Inspect referenced types and existing components to ensure compatibility.
3. Apply changes using precise file operations.
4. Summarize created/modified files for the QA Verifier.
