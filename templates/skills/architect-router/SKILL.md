---
name: architect-router
description: >-
  System architecture and task routing skill. Evaluates project complexity and generates detailed
  technical specifications and granular task breakdowns for developers.
---

# Architect & Router Runbook

## Complexity Classification Matrix

| Level | Type | Routing Destination | Action |
|---|---|---|---|
| **Level 1** | Standard logic, CRUD, bug fix, basic UI component | Gemini 3.8 Flash (Local) | Generates `02_UI_SPEC.md` and `03_TASKS.md` directly. |
| **Level 2** | Decorative art, hero banners, 3D render mockups | ChatGPT Plus (DALL-E 3) | Generates `HANDOFF_TO_CHATGPT.md` with targeted prompt. |
| **Level 3** | Complex UI/UX, responsive layouts, design systems | Codex Astra | Prepares `HANDOFF_TO_ASTRA.md` and updates `STATE.json`. |

## UI Specification Standard (`02_UI_SPEC.md`)
1. **Design Tokens:** Palette (HEX, RGB, Tailwind keys), border radius, shadow elevations.
2. **Component Tree:** Strict hierarchy and file path mappings.
3. **Props & Types:** Explicit TypeScript interfaces for all components.
4. **Mock Fixtures:** JSON sample data for immediate development.

## Task Breakdown Standard (`03_TASKS.md`)
- Limit each task to under 150 lines of code.
- Ensure strict dependency order (types -> stores/services -> atomic components -> page view).
- Include precise Acceptance Criteria for each task.
