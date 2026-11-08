# CraftSquad v2.0 🚀

> **Autonomous BMAD Multi-Engine Agile Orchestrator for Antigravity 2.0, OpenAI Codex, and Claude Code (Web & Mobile)**  
> Antigravity acts as the Primary Scrum Hub, driving Codex CLI (GPT-6.1 Sol / GPT-6 Astra) and Claude Code CLI (Sonnet 3.7) via a Local MCP Server with seamless cross-engine orchestration and automated workflow synchronization.

Fully aligned with the **BMAD-METHOD** and **GitHub Spec-Kit** Agile SDD standards.

---

## 🎯 The Problem Solved

1. **Vibe Coding Pitfalls:** Loose prompting produces brittle, unmaintainable code. CraftSquad enforces **Spec-Driven Development (SDD)** with atomic User Stories and Given-When-Then Acceptance Criteria.
2. **Manual Copy-Paste Fatigue:** Traditionally, coordinating Antigravity, ChatGPT Desktop, and Claude Code required tedious copying of prompt specs and pasting code back and forth.
3. **Multi-Model Specialization:** Combine the unique strengths of frontier models—Gemini 3.8 Flash for project management and specifications, OpenAI Codex for architecture and adversarial review, and Claude Sonnet for deep implementation.
4. **Adversarial Verification:** Eliminates confirmation bias. Code written by one model is cross-examined by a different frontier model (Adversarial Review inspired by OpenAI's `codex-plugin-cc`).
5. **Mobile Remote Development:** Run and orchestrate the full engineering team directly from your smartphone using Antigravity Mobile.

---

## 🏗️ Architecture: Multi-Engine Local MCP Bridge

```text
┌────────────────────────────────────────────────────────┐
│               ANTIGRAVITY 2.0 (PRIMARY HUB)            │
│  - BMAD Product Owner & Scrum Master (/bmad-sprint)    │
│  - Full-Stack Developer (/bmad-dev)                    │
│  - Deterministic QA Gatekeeper (/bmad-qa)              │
└──────────────────────────┬─────────────────────────────┘
                           │
                 Native Local MCP Tool Call
    (codex_architect_plan / codex_design_ui / codex_adversarial_review /
     claude_code_exec / claude_adversarial_review / claude_rescue)
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│      CRAFTSQUAD MULTI-ENGINE MCP SERVER (stdio)        │
│  - mcp-server/index.js (JSON-RPC 2.0)                  │
│  - Auto-registered in ~/.gemini/antigravity/mcp_config │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
         Subprocess                   Subprocess
    (codex exec via stdin)        (claude -p via stdout)
              │                            │
              ▼                            ▼
┌──────────────────────────┐ ┌──────────────────────────┐
│   OPENAI CODEX CLI       │ │    CLAUDE CODE CLI       │
│ - ChatGPT Plus Quota     │ │ - Claude Pro Quota       │
│ - gpt-6.1-sol (Arch/Sec) │ │ - Sonnet 3.7 (Logic/TDD) │
│ - gpt-6-astra (UI/UX)    │ │ - Adversarial Reviewer   │
└──────────────────────────┘ └──────────────────────────┘
```

---

## 👥 BMAD Specialized Roles

| Role | Persona / Engine | Execution Method | Primary Responsibility |
|---|---|---|---|
| **Product Owner & Scrum Master** | Antigravity (Gemini 3.8 Flash) | Primary Agent | Slices PRDs into Sprints & atomic User Stories (`STORY-YY.md`) with Given-When-Then criteria. |
| **System & DB Architect** | **Codex Planner** (`gpt-6.1-sol`) | Local MCP (`codex_architect_plan`) | Deep architecture, database schemas, and data contracts. |
| **Lead UX/UI Designer** | **Codex Astra** (`gpt-6-astra`) | Local MCP (`codex_design_ui`) | Cross-platform visual design: design tokens, touch targets ($\ge 48\text{dp}$), safe areas, skeletons. |
| **Full-Stack Developer** | Subagents `dev_be` & `dev_fe` / Claude | Subagent / Dev Persona | Implements backend endpoints, business logic, transactions, and wires state into UI Skeletons. |
| **Adversarial Reviewer** | **Codex Sentinel** / **Claude Sonnet** | Local MCP (`codex_adversarial_review`) | Skeptical cross-model audit of code diffs against specs to catch bugs, logic flaws, and AppSec risks. |
| **Rescue Engineer** | **Codex Sol** / **Claude Sonnet** | Local MCP (`codex_rescue` / `claude_rescue`) | Escalation rescue triggered when a task or compilation fails $\ge 2$ times. |
| **QA Build Gatekeeper** | Local CLI Runner | Terminal Execution | Release gatekeeper running compiler, typecheck, test suites, and build scripts (mandatory exit code 0). |

---

## ⚡ Quick Start (1-Minute Setup)

### 1. Prerequisites
* **Antigravity 2.0** or **Antigravity CLI (`agy`)** installed and authenticated.
* **Codex CLI (`@openai/codex`)** authenticated via ChatGPT Plus:
  ```bash
  npm install -g @openai/codex
  codex login
  ```
* **Claude Code CLI (`@anthropic-ai/claude-code`)** authenticated via Claude Pro:
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude login
  ```

### 2. Install CraftSquad Global Plugin
Run inside the repository:
```bash
node bin/cli.js install
```

This single command:
1. Installs the global Antigravity plugin (`~/.gemini/config/plugins/craft-squad`).
2. Registers the `craft-squad-codex` Multi-Engine Local MCP server into `~/.gemini/antigravity/mcp_config.json`.
3. Synchronizes all 9 Lazy MCP tool schemas for instant Antigravity discovery.

---

## 📖 Slash Commands Available in Antigravity

- `/bmad-sprint`: Plan a new Sprint, break down epics into atomic stories in `docs/sprints/sprint-XX/`.
- `/bmad-architect`: Dispatch architecture and database schema requirements to Codex Planner (`gpt-6.1-sol`).
- `/bmad-ui`: Dispatch presentational UI requirements to Codex Astra (`gpt-6-astra`).
- `/bmad-dev`: Implement backend routes and frontend state wiring strictly according to contracts.
- `/bmad-review`: Run adversarial cross-checking review using a different frontier model.
- `/bmad-rescue`: Escalate stuck tasks or compiler error loops to frontier reasoning models.
- `/bmad-qa`: Run deterministic builds and verification suites (e.g. `npm test`, `npm run build`).
