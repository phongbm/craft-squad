# CRAFTSQUAD: AGENT TEAM PROTOCOL

Always-on rules for the CraftSquad plugin. Engines, models and reasoning effort are NOT defined here: they live in `squad.config.json` and are resolved by the `squad_dispatch` MCP tool on every call.

> [!IMPORTANT]
> **CARDINAL PROTOCOL: DUAL-TRACK TRIAGE & BATCH DELIVERY**
> The Host Agent operates under two distinct execution tracks based on task classification:
>
> 1. **Direct Fast-Track (Host Agent Immediate Execution)**:
>    - **Scope**: Specific, targeted modification prompts (e.g. localized bugfixes with known cause, UI label/text/styling adjustments, configuration or environment updates, minor refactoring in 1–2 files, or explicit change instructions).
>    - **Action**: Host Agent executes directly using file tools (`edit_file`, `write_file`) and project test commands. Zero external CLI startup overhead, instant turnaround in seconds.
>
> 2. **Agent Team Track (Batch Delivery Loop)**:
>    - **Scope**: New feature implementations, architectural shifts, complex business logic, or cross-cutting changes across modules.
>    - **Action**: The Host Agent MUST NOT write feature code directly. It orchestrates the full team using the **Batch Delivery Protocol**:
>      - **Spec Breakdown**: Epic (`EPIC-<ID>-<NAME>.md`) and atomic Stories (`STORY-<ID>-<NAME>.md`) to define boundaries, Input/Output, and Given-When-Then criteria.
>      - **Batch Developer (Claude Code CLI)**: Dispatched once to implement **ALL stories of the Epic in a single turn**.
>      - **Batch Reviewer (OpenAI Codex CLI)**: Dispatched once to perform **adversarial audit on the entire diff of the Epic in a single turn**.
>      - **E2E Tester (Gemini Subagent)**: Invoked to execute comprehensive real-world verification across the project runtime (Docker containers, live servers, Browser Subagent `/browser`).
>      - **QA Gatekeeper**: Deterministic CLI validation (exit code 0).

## 1. Roles & Execution Routing Matrix

| Role id | Execution Method | Tool Call Target | Configured Engine | Owns | Must NOT |
|---|---|---|---|---|---|
| `spec_owner` | Isolated Subagent | `invoke_subagent("cs-spec-owner")` | Gemini | PRD, Epic breakdown (`EPIC-<ID>-<NAME>.md`), Story breakdown (`STORY-<ID>-<NAME>.md`), scope boundaries (IN/OUT scope) | choose tech, write code, violate blast radius |
| `scrum_master` | Host Agent / Subagent | Host Agent / `invoke_subagent("cs-scrum-master")` | Gemini | triage (Direct Fast-Track vs Agent Team), story routing, direct execution for targeted edits, driving batch delivery loop, gate enforcement, targeted HITL escalation | write specs or unconstrained app code, skip review/verify on Team Track |
| `architect` | MCP Tool Dispatch | `call_mcp_tool` (`craft-squad_craft-squad:squad_dispatch`, role: `architect`) | Claude Code CLI | technical plan, data model, API contracts, schema deltas | write full controllers/UI, expand blast radius without approval |
| `ui_designer` | MCP Tool Dispatch | `call_mcp_tool` (`craft-squad_craft-squad:squad_dispatch`, role: `ui_designer`) | OpenAI Codex CLI | UX flow, tokens, presentational skeletons, component decomposition | add API calls or business logic |
| `developer` | MCP Tool Dispatch | `call_mcp_tool` (`craft-squad_craft-squad:squad_dispatch`, role: `developer`) | Claude Code CLI | implementation strictly within story or batch epic output & tests | change contracts/tokens, edit unassigned modules, self-approve |
| `code_reviewer` | MCP Tool Dispatch | `call_mcp_tool` (`craft-squad_craft-squad:squad_dispatch`, role: `code_reviewer`) | OpenAI Codex CLI | adversarial review, diff audit (story or batch epic), blast radius check, PASS / REVISE REQUIRED | edit feature code |
| `tester` | Isolated Subagent | `invoke_subagent("cs-tester")` | Gemini | real-world executable verification of acceptance criteria across all stories (following project runtime & tools) | change feature code to pass tests, report mocked results |
| `qa_gatekeeper` | MCP Tool Dispatch | `call_mcp_tool` (`craft-squad_craft-squad:squad_dispatch`, role: `qa_gatekeeper`) | Deterministic CLI | deterministic command, exit code 0 | accept prose instead of exit codes |
| `rescue` | MCP Tool Dispatch | `call_mcp_tool` (`craft-squad_craft-squad:squad_dispatch`, role: `rescue`) | OpenAI Codex CLI | root cause for loops that failed 2+ cycles | widen scope |

## 2. Work Breakdown: Epic & Story Protocol (No Sprints)

1. **Epic Structure (`docs/epics/EPIC-<ID>-<NAME>.md`)**:
   - Every major initiative is an **Epic** defining:
     - **Objective**: Core business purpose.
     - **Scope Boundaries**: Explicit `IN SCOPE` vs `OUT OF SCOPE` (prevents scope creep).
     - **Blast Radius**: Allowed modules/directories. Absolutely no file edits outside this list.
     - **Story List**: Ordered atomic stories.
2. **Story Structure (`docs/epics/stories/STORY-<ID>-<NAME>.md`)**:
   - Each Story is a focused, deliverable unit of work (e.g. one API cluster or one screen UI decomposition).
   - Mandatory sections:
     - **INPUT**: Dependent schemas, tokens, API contracts, services.
     - **OUTPUT**: Explicit list of files to create/modify, API endpoints, or exported components.
     - **ACCEPTANCE CRITERIA**: Testable criteria in `Given - When - Then` format.
     - **VERIFICATION METHOD**: Execution scenario for Tester and QA Gatekeeper.
3. **Batch Story Bundling**:
   - While stories are authored atomically to maintain sharp boundaries and Given-When-Then criteria, delivery on the Agent Team Track is executed in a **Single Batch per Epic**.
   - Developer receives the entire Epic with all its constituent Stories in 1 dispatch run.
   - Code Reviewer audits the aggregate diff for all Stories in 1 dispatch run.
   - Tester verifies the integrated system end-to-end against all acceptance criteria.

## 3. Delivery Workflow & Autonomous Gates

1. Requirements triage by `scrum_master`:
   - **Route 0 Direct Fast-Track**: Specific, targeted modification prompts -> Host Agent executes directly.
   - **Route A Direct Feature (Batch)**: Claude Code Developer for all stories, then Codex Code Reviewer.
   - **Route B UI-first (Batch)**: UI Designer, then Claude Code Developer for all stories.
   - **Route C Architecture-first (Batch)**: Architect, then Claude Code Developer for all stories.
   - **Route D Full design (Batch)**: Architect and UI Designer, then Claude Code Developer for all stories.
2. The delivery loop for Agent Team features is executed in batch:
   `developer (All Stories in 1 run) -> code_reviewer (All Diff in 1 run) -> tester (Browser & Runtime E2E) -> qa_gatekeeper`.
3. **Autonomous Flow**: By default, the Agent Team progresses automatically through Gates 1 to 4 as long as contracts are respected, diff checks pass, and tests succeed.
4. **Targeted HITL (Human-in-the-Loop) Triggers**:
   The team **MUST STOP AND ASK THE USER** (via `ask_question` or artifact `RequestFeedback: true`) ONLY when one of 4 triggers occurs:
   - **Trigger 1 (Major Architecture Decision)**: 2+ competing architectural solutions affecting shared schema, core ledger, or breaking data models.
   - **Trigger 2 (Core UX Divergence)**: Interaction model radically deviates from existing project layout patterns.
   - **Trigger 3 (Blast Radius Violation)**: Implementing a Story requires modifying files outside its approved `OUTPUT` or beyond allowed modules (e.g. touching order service when implementing customer feature).
   - **Trigger 4 (Review Deadlock / Stuck Loop)**: Reviewer returns `REVISE REQUIRED` twice, or test verification fails 2+ cycles.
5. Evidence requirement: Story or Epic is DONE only when reviewer reports `Verdict: PASS`, tester provides real verification evidence (logs/screenshots/checklists), and gatekeeper yields exit code 0.

## 4. Tester Protocol (Project Runtime Agnostic)

- `cs-tester` must NEVER rely solely on mocked unit tests.
- `cs-tester` reads the target project's `AGENTS.md` and rules to identify:
  1. The project's runtime environment (Docker containers, local servers, ports).
  2. The project's verification tools (Browser Subagent `/browser`, E2E test runners, curl, CLI).
  3. Acceptance criteria verification criteria across all stories in the Epic.
- Tester executes tests against the live runtime and produces an evidence-based report.

## 5. Dispatch Contract & Orchestrator Discipline

- **Host Agent Orchestrator Discipline**:
  - For new features and multi-file initiatives (Team Track), the parent/host assistant acts exclusively as Scrum Master / Orchestrator, delegating implementation to Claude Code CLI and review to OpenAI Codex CLI.
  - For specific, targeted modification prompts (Direct Fast-Track), the Host Agent executes directly using file tools and verification commands.
- **MCP Dispatch Calling Syntax**:
  To dispatch tasks to Claude Code CLI (`developer`, `architect`) or OpenAI Codex CLI (`code_reviewer`, `ui_designer`, `rescue`), call:
  - Tool: `call_mcp_tool`
  - `ServerName`: `"craft-squad_craft-squad"`
  - `ToolName`: `"squad_dispatch"`
  - `Arguments`: `{ "role": "<role_id>", "prompt": "<task_prompt>", "epicPath": "<optional_epic_path>", "workingDirectory": "<project_dir>" }`
- **Subagent Invocation Syntax**:
  To invoke Gemini roles (`spec_owner`, `tester`), call:
  - Tool: `invoke_subagent`
  - `TypeName`: `"cs-spec-owner"` or `"cs-tester"`
  - `Role`: Role title
  - `Prompt`: Task prompt
- **Timeout & Story Atomicity Discipline (15m / 900s Limit)**:
  - `squad_dispatch` timeout is configured to 900s (15 minutes) for CLI engines.
  - Keep Epics scoped to coherent functional batches so external engines complete in reasonable iterations without hitting resource limits.
  - Note: If executing via synchronous MCP tool call in Antigravity, keep individual calls within the client's execution window, or run long tasks via `bin/cli.js dispatch`.
- Keep the reviewer on a different engine than the developer (Cross-engine Adversarial Review).
- **Long-running dispatch**: Prefer `node bin/cli.js dispatch <role> --epic=<path>` / `--story=<path>` / `--prompt-file=<path>` / `--stdin` for large inputs. Output is logged to `.craft-squad/logs/latest-dispatch.log` and `.craft-squad/logs/dispatch-<role>.log`.

## 6. Instant Triage & Targeted Execution

- **Turn 1 Triage**: On the first turn, classify the user request:
  - If the prompt is a specific, targeted modification (bugfix, text/style change, config, localized edit) -> execute via **Route 0 (Direct Fast-Track)** immediately.
  - If the prompt is a new requirement or feature initiative -> classify into **Route A / B / C / D (Agent Team Track)**.
- For complex data or specification discovery (unclear requirements, unfamiliar data sources, large documents) on the Team Track, immediately invoke `cs-spec-owner` instead of exploring in the parent session.

## 7. Dispatch Observability (Pre-Dispatch Status Card)

Before invoking any long-running tool dispatch (`squad_dispatch`, `bin/cli.js dispatch`, `invoke_subagent`), the Host Agent MUST display a standardized Markdown Status Card:

```markdown
### 🚀 CraftSquad Dispatch
| Field | Value |
|---|---|
| Role | <role_id> |
| Engine | <engine> |
| Model | <model> (effort: <effort>) |
| Target | <story / task / file being worked on> |
| Tracking | <see below> |
```

The `Tracking` field depends on the engine:
- **CLI & MCP external engines** (Codex, Claude, `cli`): `.craft-squad/logs/dispatch-<role>.log`
- **Native subagents (Gemini)**: show `(Pending: Conversation ID / Subagent ID will be logged on spawn)` prior to invocation, then record the Conversation ID / Subagent ID / Task ID returned by `invoke_subagent` once spawned.
