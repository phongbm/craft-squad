# CRAFTSQUAD: AGENT TEAM PROTOCOL

Always-on rules for the CraftSquad plugin. Engines, models and reasoning effort are NOT defined here: they live in `squad.config.json` and are resolved by the `squad_dispatch` MCP tool on every call.

## 1. Roles

| Role id | Skill | Owns | Must NOT |
|---|---|---|---|
| `spec_owner` | `/cs-spec-owner` | PRD, constitution, feature specs, acceptance criteria | plan tasks, choose tech, write code |
| `scrum_master` | `/cs-scrum-master` | triage, sprint/tasks, assignment, driving the loop, evidence-based sign-off | write specs or app code, skip review/verify |
| `architect` | `/cs-architect` | technical plan, data model, API contracts | write full controllers/UI |
| `ui_designer` | `/cs-ui-designer` | UX flow, tokens, presentational skeletons | add API calls or business logic |
| `developer` | `/cs-developer` | implementation and tests | change contracts/tokens, self-approve |
| `code_reviewer` | `/cs-code-reviewer` | adversarial review, PASS / REVISE REQUIRED | edit feature code |
| `tester` | `/cs-tester` | executable verification of acceptance criteria | change feature code to pass tests |
| `qa_gatekeeper` | `/cs-qa-gatekeeper` | deterministic command, exit code 0 | accept prose instead of exit codes |
| `rescue` | `/cs-rescue` | root cause for loops that failed 2+ cycles | widen scope |

## 2. Delivery workflow

1. Requirements (new or changed) belong to `spec_owner`. The Scrum Master never invents them.
2. `scrum_master` triages each item into one route and states why:
   - A Direct: Developer only.
   - B UI-first: UI Designer, then Developer.
   - C Architecture-first: Architect, then Developer.
   - D Full design: Architect and UI Designer, then Developer.
3. Design roles are optional per task. The loop below is mandatory for every task, however small:
   `developer -> code_reviewer -> tester -> qa_gatekeeper`.
4. REVISE REQUIRED, failing tests or a non-zero exit code return the task to `developer`. After 2 failed cycles on one issue, call `rescue`.
5. A task is DONE only with evidence: reviewer `Verdict: PASS`, tester checklist, gatekeeper exit code 0.
6. Requirement change mid-flight: update the spec first (`[REV-n: ...]`), then re-plan, then code.

## 3. Dispatch contract

- Call roles through `squad_dispatch(role, prompt, artifactType?, workingDirectory)`. Never name models or engines in prompts or skills.
- Roles on the `gemini` engine return a compiled role prompt that the host agent executes itself; `codex` / `claude` roles execute and return output; `cli` roles run their configured command.
- Reasoning effort per call: add `[effort: low|medium|high|xhigh]` to the prompt to override config.
- Keep the reviewer on a different engine/model than the developer.

## 4. Standards

Role personas, review methods and document templates come from upstream BMAD-METHOD and GitHub Spec-Kit, read at runtime from `templates/` (refresh with `npm run sync:upstream`; provenance in `UPSTREAM_EVIDENCE.md`).
