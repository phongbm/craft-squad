# CRAFTSQUAD: BMAD MULTI-ENGINE AGENT PROTOCOL

This rule governs the autonomous multi-agent development lifecycle within Antigravity 2.0, integrating the **BMAD-METHOD Agile Framework** with **OpenAI Codex CLI** and **Claude Code CLI** across Web & Mobile applications.

---

## 1. Squad Roles & Engine Assignment Matrix

| Role | Persona / Engine | Execution Method | Core Responsibility | Strict Boundaries (What NOT to do) |
|---|---|---|---|---|
| **1. Product Owner & Scrum Master** | Antigravity Hub (Gemini 3.8 Flash) | Primary Orchestrator | Analyzes PRD and user requirements, manages backlog, slices Sprints into atomic User Stories (`STORY-YY.md`) using GitHub Spec-Kit format, handles change requests. | Does not write application code directly. |
| **2. System & DB Architect** | Codex Planner (`gpt-6.1-sol`) | Local MCP (`codex_architect_plan`) | Deep architecture, domain modeling, state machine design, database schemas, and data contracts. | Produces architectural specs and schemas only; does not write full application controllers or UI. |
| **3. Lead UX/UI Designer** | Codex Astra (`gpt-6-astra`) | Local MCP (`codex_design_ui`) | Cross-platform visual design: design tokens, touch targets ($\ge 44\text{--}48\text{dp}$), safe areas, and **Presentational Component Skeletons** (React, Vue, Flutter, Tailwind, etc.). | **Produces Presentational UI only.** Does not write backend logic or state stores. |
| **4. Full-Stack Developer** | Subagents `backend_dev` & `frontend_dev` (or Claude Code) | Antigravity Subagent / CLI | Implements backend endpoints, business logic, transactions, and wires client-side state into UI Skeletons. | Must adhere 100% to Architect's contracts and UI Designer's visual tokens without alteration. |
| **5. Adversarial Reviewer** | Codex Sentinel (`gpt-6.1-sol`) / Claude Sonnet | Local MCP (`codex_adversarial_review` / `claude_adversarial_review`) | Independent, skeptical audit of code diffs against Acceptance Criteria, finding subtle logic flaws, edge cases, and AppSec risks. | Does not write feature code; outputs strict PASS or REVISE verdicts with remediation patches. |
| **6. Rescue Engineer** | Codex Sol (`gpt-6.1-sol`) / Claude Sonnet | Local MCP (`codex_rescue` / `claude_rescue`) | Triggered when a build, test, or debugging loop fails $\ge 2$ times to provide fresh frontier reasoning resolution. | Focuses solely on resolving the blocking issue cleanly. |
| **7. QA & Build Gatekeeper** | Deterministic CLI Runner | Local Terminal | Release gatekeeper running compilers, typecheckers, test suites, and build scripts (e.g. `npm test`, `npm run build`). | **Exit code 0 mandatory.** LLM verbal praise is rejected without executable proof. |

---

## 2. The Living Spec Loop (Agile Change Management)

Unlike Waterfall development, requirements evolve. CraftSquad enforces the **Living Spec Loop**:

1. **System Baseline (Macro):** `docs/PRD.md` and `docs/ARCHITECTURE.md` establish permanent domain entities, business invariants, and tech stack boundaries.
2. **Sprint & Story Slicing (Micro):** Every sprint lives in `docs/sprints/sprint-XX/`. Each User Story has its own `STORY-YY.md` containing:
   - User Story (Role - Action - Value)
   - Acceptance Criteria (Given-When-Then)
   - Data Contracts & Schemas
   - UI/UX Skeleton Requirements
   - Gatekeeper Checklist
3. **Mid-Sprint Spec Updates:**
   - When a requirement changes mid-sprint, **never edit code immediately**.
   - PO updates `STORY-YY.md` with revision tag `[REV-XX: Description]`.
   - Architect updates the Schema/DTO delta.
   - Developer refactors code against the spec diff.
   - QA Gatekeeper re-verifies the build.

---

## 3. Dynamic Pipeline Routing (Scope-Aware Tiers)

To optimize velocity, CraftSquad routes tasks into 4 execution tiers:

- **Tier 1: Quick Fix (S)** (1–2 files, typo, padding, minor bug):
  - Workflow: PO $\rightarrow$ Codex Astra / Dev $\rightarrow$ QA Gatekeeper.
  - Skips: Architect, Adversarial Review.
- **Tier 2: Frontend UI Feature (M)** (Client UI, navigation, state):
  - Workflow: PO $\rightarrow$ Codex Astra (UI Skeleton) $\rightarrow$ Frontend Dev $\rightarrow$ Adversarial Review $\rightarrow$ QA Gatekeeper.
  - Skips: DB Architect.
- **Tier 3: Backend / Database Feature (M)** (APIs, migrations, transactions):
  - Workflow: PO $\rightarrow$ Codex Planner (Schema) $\rightarrow$ Backend Dev $\rightarrow$ Adversarial Review $\rightarrow$ QA Gatekeeper.
  - Skips: UI Designer.
- **Tier 4: Full-Stack Enterprise Feature (L/XL)** (End-to-end spanning DB, APIs, State, UI, Container):
  - Workflow: Full 7-Role Squad Pipeline.

---

## 4. Multi-Engine Architecture

All cross-model delegation calls run via local CLI engines:
- `@openai/codex` CLI environment (`~/.codex/`).
- `@anthropic-ai/claude-code` CLI environment (`~/.claude/`).
- Antigravity 2.0 native execution.
