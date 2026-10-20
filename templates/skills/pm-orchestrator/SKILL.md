---
name: pm-orchestrator
description: >-
  Lead PM & Multi-Agent Orchestrator workflow for CraftXTech. Use when the user wants to brainstorm,
  design, or orchestrate building features across subagents and external models.
---

# CraftXTech PM Orchestrator Workflow

## Phase 1: Interactive Brainstorming & Feature Slug Assignment
1. Elicit requirements from the user.
2. Determine a unique, lowercase kebab-case identifier for this feature (e.g. `feat-booking`, `feat-avatar`).
3. Ensure the dedicated folder exists: `.agents/features/<feature-slug>/`.
4. Ask 3-5 focused questions about:
   - Target personas & main user journey.
   - Core MVP requirements vs secondary features.
   - Design guidelines (color theme, tone, target screen sizes).
5. Synthesize into `.agents/features/<feature-slug>/01_PRD.md`.
6. Initialize or update `.agents/features/<feature-slug>/STATE.json` with `phase: "AWAITING_ROUTING"`.
7. Update root `.agents/STATE.json` to register this feature in `active_features`.

## Phase 2: Routing Decision & Physical Isolation
- **Physical Safety Rule:** Do NOT run `git checkout` to hop between branches if other chats or tools are actively operating in this workspace. Stay on the active working tree and rely on folder isolation: `src/features/<feature-slug>/`.
- **If Level 3 (Complex Web/App UI):**
  - Generate `.agents/features/<feature-slug>/HANDOFF_TO_ASTRA.md`.
  - Update `.agents/features/<feature-slug>/STATE.json` (`phase: "AWAITING_ASTRA"`).
  - Git commit with message `[AG-PM](<feature-slug>): update PRD`.
  - Notify user: *"PRD cho feature `<feature-slug>` đã được lưu. Hãy mở thread Codex Astra gõ /next để lấy UI Spec."*
- **If Level 1 (Local Gemini Execution):**
  - Draft `.agents/features/<feature-slug>/02_UI_SPEC.md` and `.agents/features/<feature-slug>/03_TASKS.md` directly.
  - Proceed straight to Phase 3.

## Phase 3: Autonomous Implementation & Testing
1. Iterate through `.agents/features/<feature-slug>/03_TASKS.md`:
   - Invoke `developer` subagent, instructing it strictly to confine code to `src/features/<feature-slug>/` or dedicated components.
2. Invoke `qa_verifier` subagent:
   - Run typecheck, lint, and build commands.
   - If tests fail, feed back to `developer`.
3. When verified, update `.agents/features/<feature-slug>/STATE.json` (`phase: "COMPLETED"`) and commit with `[AG-QA](<feature-slug>): pass build and verification`.
