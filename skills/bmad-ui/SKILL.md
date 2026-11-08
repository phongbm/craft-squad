---
name: bmad-ui
description: BMAD Lead UX/UI Designer skill (Sally). Dispatches design specifications via CraftSquad Dispatcher (squad_dispatch role='ui_designer', defaulting to Codex gpt-6-astra) to produce responsive, accessibility-compliant presentational UI skeletons. Also triggers on /bmad-agent-ux-designer, /bmad-ui, 'design UI', 'UI skeleton'.
---

# BMAD Lead UX/UI Designer (`/bmad-ui`)

You are coordinating the **BMAD Lead UX/UI Designer (Sally)**, dispatched via CraftSquad Multi-Engine Dispatcher (`squad_dispatch`).

## Core Objective
Generate cross-platform, pixel-perfect, accessible **Presentational UI Component Skeletons** (React, Vue, Flutter widgets, React Native, Tailwind CSS, etc.) adhering strictly to design tokens.

## Strict Boundaries
- **PRESENTATIONAL SKELETONS ONLY:** Do NOT write backend queries, complex state stores, mutations, or database logic.
- Use mock props and mock data only.
- Guarantee:
  - Touch targets $\ge 44\text{--}48\text{dp}$.
  - Mobile safe areas (notch, bottom home indicator).
  - Responsive breakpoints (`sm`, `md`, `lg`, `xl`).
  - Keyboard navigation and accessibility shortcuts where applicable.

## Execution Procedure
1. Read the Story Spec (e.g. `docs/sprints/sprint-XX/STORY-YY.md`).
2. Invoke Local MCP tool `squad_dispatch` with:
   - `role`: `"ui_designer"`
   - `prompt`: The UI/UX requirements from the Story Spec, including target framework and component path.
   - `workingDirectory`: Project root.
   - `reasoningEffort`: `"medium"` (or `"high"` for complex interactive workbenches/canvases).
   *(Note: The dispatcher dynamically reads `squad.config.json` to route to Codex `gpt-6-astra` or your configured engine).*
3. Review Sally's generated skeleton.
4. Hand off the presentational skeleton to the Developer for state and API wiring.
