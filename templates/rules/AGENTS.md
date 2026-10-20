# CRAFTXTECH MULTI-AGENT PROTOCOL & OPERATING SYSTEM

This rule defines the engineering team architecture, dual-engine planning system, and granular task delegation matrix.

---

## 1. The Universal Planning Invariant (No Ghost Commits)
**Every single task—regardless of size—MUST have a Plan and an updated record in the documentation.**
- Even a 1-line typo fix, button text change, or minor CSS tweak must update `.agents/features/<slug>/01_PRD.md` (or changelog section) and define a task in `03_TASKS.md`.
- No code is ever written without an explicit task and acceptance criteria. This maintains 100% auditability and eliminates documentation drift.

---

## 2. Dual-Engine Planning: Who Creates the Plan?
Before creating a plan, the PM Agent evaluates which engine possesses the required reasoning depth:

| Planning Engine | Best For | Typical Use Cases |
|---|---|---|
| **Codex (GPT-Frontier)** | High architectural ambiguity, complex domain logic, multi-tier state machines, major UI/UX redesigns. | New feature screens, financial calculations, intricate authentication flows, system refactoring. |
| **Gemini Flash (Local PM)** | Straightforward, well-patterned, or localized modifications. Instant execution with 0 handoff latency. | CRUD endpoints, standard form fields, text/style patches, bugfixes with clear reproduction steps. |

---

## 3. Granular Task-Level Delegation (Within the Same Plan)
A plan is not monolithic. In `03_TASKS.md`, each individual task is tagged with its optimal executor:

- `[DELEGATE: CODEX-UI]`: Component wireframes, Tailwind styling, visual aesthetics, responsive tokens. Codex produces Presentational Component Skeletons.
- `[DELEGATE: CODEX-LOGIC]`: Intricate business logic, algorithmic pseudocode, edge-case definitions.
- `[DELEGATE: GEMINI-DEV]`: Heavy lifting implementation—wiring state, calling APIs, assembling components, form validation. Strictly NO tests/builds.
- `[DELEGATE: GEMINI-REVIEW]`: Code audit comparing code diff against `01_PRD.md` and `02_UI_SPEC.md`.
- `[DELEGATE: GEMINI-QA]`: Compiler gatekeeper (`tsc --noEmit`, `npm run lint`, `npm run build`).
- `[DELEGATE: GEMINI-UNIT-TEST]`: (On-demand) Writing and running unit tests when `needs_unit_tests: true`.

---

## 4. The 3 Dynamic Execution Paths

```text
Path 1: Quick Patch (Hotfix / Micro)
Intake & Doc Log -> Gemini Plan -> [GEMINI-DEV] -> [GEMINI-QA] -> Complete

Path 2: Complex Logic / API (No major UI redesign)
Intake & Doc Log -> Codex or Gemini Plan -> [CODEX-LOGIC (if hard)] -> [GEMINI-DEV] -> [GEMINI-REVIEW] -> [GEMINI-QA]

Path 3: Full-Stack Feature (Rich UI + Logic)
Intake & Doc Log -> Codex Plan & UI Spec -> [CODEX-UI] + [GEMINI-DEV] -> [GEMINI-REVIEW] -> [GEMINI-QA] -> (Unit Test)
```

---

## 5. Strict Physical Concurrency & Zero-Branch-Hopping Rule
- **No Branch Hopping:** NEVER run `git checkout <other-branch>` in the shared working directory.
- **Directory Isolation:** Confine all changes strictly to `.agents/features/<slug>/` and `src/features/<slug>/`.
