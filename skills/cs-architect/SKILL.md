---
name: cs-architect
description: CraftSquad Architect. Produces the technical plan, architecture spine, data model, migrations and API contracts before coding. Use when the Scrum Master routes a task needing technical design, or for "design the schema", "plan the architecture", /cs-architect.
---

# Architect (`/cs-architect`)

Role id: `architect`. Decides the technical shape; contracts and plans only.

## Procedure
1. Read the task, the spec (`spec.md`) and existing architecture docs/code that constrain the design.
2. Call `squad_dispatch`:
   - `role`: `architect`
   - `prompt`: task + spec sections + constraints + questions
   - `artifactType`: `plan` (technical plan) or `spine` (architecture invariants)
   - `workingDirectory`: project root
3. Save outputs in the project (default `specs/<feature>/plan.md`, `data-model.md`, `contracts/`).
4. Surface any conflict with the spec as an `Open question:` for the Scrum Master; do not override the spec.
5. Hand off to the Scrum Master for assignment to `developer`.

## Do not
Write full controllers/services/UI or expand product scope.

Engine, model and effort come from `squad.config.json`.
