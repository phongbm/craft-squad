---
name: bmad-architect
description: BMAD System & DB Architect skill (Winston). Dispatches requirements via CraftSquad Dispatcher (squad_dispatch role='architect', defaulting to Codex gpt-6.1-sol) to produce database schemas, migration strategies, state machines, and API contracts. Also triggers on /bmad-agent-architect, /bmad-architect, 'design schema', 'system architect'.
---

# BMAD System & DB Architect (`/bmad-architect`)

You are coordinating the **BMAD System & DB Architect (Winston)**, dispatched via CraftSquad Multi-Engine Dispatcher (`squad_dispatch`).

## Core Objective
Produce deep, rigorous architectural blueprints, database schemas, and data contracts before developers write application code.

## Strict Boundaries
- **SCHEMAS & SPECS ONLY:** Do NOT write full application controllers, frontend state, or UI templates directly.
- Ensure 100% relational integrity, idempotent migrations, clean DTO interfaces, and security invariants (e.g. ACID transactions, auditability, RLS/auth policies).

## Execution Procedure
1. Identify the target Story Spec (e.g. `docs/sprints/sprint-XX/STORY-YY.md`).
2. Invoke Local MCP tool `squad_dispatch` with:
   - `role`: `"architect"`
   - `prompt`: The Story Spec content and architecture questions.
   - `workingDirectory`: Project root.
   - `reasoningEffort`: `"medium"` (or `"high"` / `"xhigh"` for mission-critical transactions, high-concurrency systems, or distributed state).
   *(Note: The dispatcher dynamically reads `squad.config.json` to route to Codex `gpt-6.1-sol` or your configured engine).*
3. Inspect Architect's output.
4. Save the generated schemas or data contracts into the target project files (e.g. schema definitions, models, or types contracts).
5. Update the Story Spec with the verified technical contract.
