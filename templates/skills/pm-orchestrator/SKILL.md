---
name: pm-orchestrator
description: >-
  Lead PM & Multi-Agent Orchestrator workflow for CraftSquad. Enforces universal planning,
  selects the planning engine (Codex vs Gemini), and delegates tasks with granular model tagging.
---

# CraftSquad PM Orchestrator Workflow

## Phase 1: Intake & Universal Documentation (Mandatory)
1. Listen to the user's request.
2. Assign a unique feature slug (e.g. `feat-booking`, `fix-checkout-btn`).
3. Ensure `.agents/features/<slug>/` exists.
4. **Update Documentation:**
   - For major features: Write full `.agents/features/<slug>/01_PRD.md`.
   - For minor patches/hotfixes: Append to the `Changelog / Quick Patch` section in `01_PRD.md`.
   - *Never skip this step to preserve code traceability.*

## Phase 2: Dual-Engine Planning Decision
Assess the required reasoning depth:
- **Codex Planner (Frontier Reasoning):** When features involve complex architectures, multi-tier state, or high-fidelity UI/UX design.
  -> Generate `HANDOFF_TO_CODEX_PLANNER.md` for the user to paste into Codex.
- **Gemini Planner (Local Fast Plan):** When the solution follows established patterns, standard CRUD, or localized bugfixes.
  -> PM authors the plan and breaks down tasks directly on-the-fly.

## Phase 3: Granular Task Breakdown (`03_TASKS.md`)
Each task in `03_TASKS.md` must be tagged with its executor:
- `- [ ] Task N: [DELEGATE: CODEX-UI] ...`: For Codex Astra presentational components & styling.
- `- [ ] Task N: [DELEGATE: CODEX-LOGIC] ...`: For Codex Astra algorithms / complex state specs.
- `- [ ] Task N: [DELEGATE: GEMINI-DEV] ...`: For Gemini Developer implementation (logic, state, API).
- `- [ ] Task N: [DELEGATE: GEMINI-REVIEW] ...`: For Gemini Code Reviewer audit.
- `- [ ] Task N: [DELEGATE: GEMINI-QA] ...`: For Gemini QA Verifier compiler & build check.
- `- [ ] Task N: [DELEGATE: GEMINI-UNIT-TEST] ...`: (Optional) Authoring unit tests when requested.

## Phase 4: Sequential Execution Dispatch
1. For `[DELEGATE: CODEX-...]` tasks: Prepare handoff file and pause for the user to paste the spec into `.agents/features/<slug>/02_UI_SPEC.md`.
2. For `[DELEGATE: GEMINI-DEV]` tasks: Invoke subagent `developer` to implement code cleanly without running builds/tests.
3. For `[DELEGATE: GEMINI-REVIEW]` tasks: Invoke `code_reviewer` to audit code against specs.
4. For `[DELEGATE: GEMINI-QA]` tasks: Invoke `qa_verifier` to run compiler & build checks.
5. Update `STATE.json` (`phase: "COMPLETED"`) and present a concise summary to the user.
