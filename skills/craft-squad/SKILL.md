---
name: craft-squad
description: CraftSquad master orchestrator. Explains and runs the multi-role agent team (Spec Owner, Scrum Master, Architect, UI Designer, Developer, Code Reviewer, Tester, QA Gatekeeper, Rescue) with config-driven engines. Use for "run the squad", "which role does X", "change a role's model", /craft-squad.
---

# CraftSquad

A role-based agent team. Roles, skills and who-calls-whom are fixed here; which engine, model and effort each role uses lives only in `squad.config.json` and is resolved on every `squad_dispatch`.

## Roles and skills
| Role id | Skill | Real-world equivalent |
|---|---|---|
| `spec_owner` | `/cs-spec-owner` | Product owner / BA: PRD, spec, acceptance criteria |
| `scrum_master` | `/cs-scrum-master` | Engineering team lead: triage, plan, assign, drive loop, report |
| `architect` | `/cs-architect` | Technical plan, data model, contracts |
| `ui_designer` | `/cs-ui-designer` | UX flow, tokens, presentational skeletons |
| `developer` | `/cs-developer` | Implementation with tests |
| `code_reviewer` | `/cs-code-reviewer` | Independent adversarial review |
| `tester` | `/cs-tester` | Executable verification of acceptance criteria |
| `qa_gatekeeper` | `/cs-qa-gatekeeper` | Deterministic gate, exit code 0 |
| `rescue` | `/cs-rescue` | Root-cause for stuck loops |

## Flow
```
Request -> [new/changed requirement? -> Spec Owner -> spec] -> Scrum Master (triage + plan)
   Route A: -> Developer
   Route B: -> UI Designer -> Developer
   Route C: -> Architect -> Developer
   Route D: -> Architect + UI Designer -> Developer
Developer -> Code Reviewer -> Tester -> QA Gatekeeper -> Scrum Master sign-off
(2 failed cycles on one issue -> Rescue -> back into the loop)
```
Design roles are optional per task; review, test and gate are never optional.

## Configuration
- Show: tool `squad_get_config` or `node bin/cli.js status`.
- Change a role: tool `squad_set_role` or `node bin/cli.js config set <role> <engine> [model]`.
- One-off effort: add `[effort: low|medium|high|xhigh]` to a prompt.
- Gemini-engine roles default to the effort in `geminiDefaultReasoningEffort`; other roles to `defaultReasoningEffort`.

## Standards
Role personas, methods and document templates are read at runtime from upstream BMAD-METHOD (`templates/bmad/`) and GitHub Spec-Kit (`templates/speckit/`); refresh with `npm run sync:upstream`. Provenance: `UPSTREAM_EVIDENCE.md`.
