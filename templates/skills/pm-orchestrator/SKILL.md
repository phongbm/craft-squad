---
name: pm-orchestrator
description: >-
  Lead PM & Multi-Agent Orchestrator workflow for CraftXTech. Use when the user wants to brainstorm,
  design, or orchestrate building features across subagents and external models.
---

# CraftXTech PM Orchestrator Workflow

## Phase 1: Interactive Brainstorming
1. Greet the user and elicit the core product vision.
2. Ask 3-5 focused questions about:
   - Target personas & main user journey.
   - Core MVP requirements vs secondary features.
   - Design guidelines (color theme, tone, target screen sizes).
3. Synthesize the findings into `.agents/01_PRD.md`.
4. Update `.agents/STATE.json` with `phase: "AWAITING_ROUTING"`.

## Phase 2: Routing Decision
- **If Level 3 (Complex Web/App UI):**
  - Generate `.agents/HANDOFF_TO_ASTRA.md`.
  - Update `.agents/STATE.json` (`phase: "AWAITING_ASTRA"`).
  - Git commit with message `[AG-PM] feat(prd): update PRD for <feature>`.
  - Notify user: *"PRD đã được commit. Hãy mở thread Codex Astra gõ /next để lấy UI Spec."*
- **If Level 1 (Local Gemini Execution):**
  - Draft `.agents/02_UI_SPEC.md` and `.agents/03_TASKS.md` immediately.
  - Proceed straight to Phase 3.

## Phase 3: Autonomous Implementation & Testing
1. Iterate through `.agents/03_TASKS.md`:
   - Invoke `developer` subagent to write clean, typed code.
2. Invoke `qa_verifier` subagent:
   - Run typecheck, lint, and build commands.
   - Automatically remediate import or minor syntax errors.
   - If tests fail, feed back to `developer`.
3. When verified, update `.agents/STATE.json` (`phase: "COMPLETED"`) and commit with `[AG-QA] test: pass build and verification`.
