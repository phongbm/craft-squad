# CraftSquad

A role-based agent team for Antigravity. Roles, skills and workflow are fixed; **which engine, model and reasoning effort each role uses is configuration** (`squad.config.json`), re-read on every call.

Standards are upstream, not invented here: role personas and review methods come from [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD), document templates from [GitHub Spec-Kit](https://github.com/github/spec-kit). Both are synced into `templates/` (`npm run sync:upstream`, provenance in `UPSTREAM_EVIDENCE.md`) and **read at runtime** by the prompt compiler.

## Roles

| Role id | Skill | Equivalent |
|---|---|---|
| `spec_owner` | `/cs-spec-owner` | PRD, constitution, feature specs, acceptance criteria |
| `scrum_master` | `/cs-scrum-master` | Team lead: triage, plan, assign, drive loop, report |
| `architect` | `/cs-architect` | Technical plan, data model, contracts |
| `ui_designer` | `/cs-ui-designer` | UX flow, tokens, presentational skeletons |
| `developer` | `/cs-developer` | Implementation with tests |
| `code_reviewer` | `/cs-code-reviewer` | Independent adversarial review |
| `tester` | `/cs-tester` | Executable verification |
| `qa_gatekeeper` | `/cs-qa-gatekeeper` | Deterministic gate (exit code 0) |
| `rescue` | `/cs-rescue` | Root cause for stuck loops |

`/craft-squad` explains the team and flow. Charters (duties, boundaries, handoffs) are in `charters/`.

## Workflow

```
Request -> [new/changed requirement -> Spec Owner -> spec] -> Scrum Master (triage + plan)
  A Direct: Developer
  B UI-first: UI Designer -> Developer
  C Architecture-first: Architect -> Developer
  D Full design: Architect + UI Designer -> Developer
Developer -> Code Reviewer -> Tester -> QA Gatekeeper -> sign-off
(2 failed cycles on one issue -> Rescue)
```

Design roles are optional per task. Review, test and gate always run.

## How it works

1. A skill (or the Scrum Master) calls the MCP tool `squad_dispatch(role, prompt, artifactType?, workingDirectory)`.
2. The dispatcher reads `squad.config.json` and resolves engine, model and effort (`[effort: high]` in a prompt overrides).
3. The prompt compiler builds the role prompt from `charters/<role>.md`, the upstream BMAD persona (`customize.toml`), upstream references and the requested template (Spec-Kit `spec/plan/tasks/checklist/constitution`, BMAD `ticket/spine`).
4. Execution by engine: `codex` / `claude` run the local CLI with the prompt on stdin; `gemini` returns the compiled prompt for the host agent; `cli` runs the configured command and reports the exit code.

`dryRun: true` shows routing and the compiled prompt without running anything.

## Configuration

```bash
node bin/cli.js status                                   # engines and role matrix
node bin/cli.js config set <role> <engine> [model] [effort]
node bin/cli.js dispatch <role> "<task>" --dry [--artifact=spine]
node bin/cli.js init                                     # copy squad.config.json + schema into a project
```

Effort: Gemini-engine roles use `geminiDefaultReasoningEffort`, others `defaultReasoningEffort`; per-role `defaultReasoningEffort` and prompt tags override.
The reviewer should run on a different engine than the developer.

## Prerequisites

Node 18+, Codex CLI (`codex login`) and Claude Code CLI (`claude login`) for roles that use them. `node bin/cli.js install` links the plugin into `~/.gemini/config/plugins/craft-squad`.

## Tests

`npm run test:dispatcher`: offline checks of config, no-hardcoded-models, runtime upstream reads, routing and exit codes.
