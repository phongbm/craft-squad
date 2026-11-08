---
name: craft-squad
description: Master multi-agent agile orchestrator for Antigravity 2.0. Coordinates BMAD-METHOD personas (Sofia PO, Winston Architect, Sally UI Designer, Amelia Dev, Oliver Reviewer) and GitHub Spec-Kit formats with multi-engine execution (OpenAI Codex, Claude Code, Gemini 3.8 Flash).
---

# CraftSquad v2.2 Master Orchestrator

Use this skill when developing features, refactoring, or managing agile sprints across Web and Mobile applications using an orchestrated multi-agent team.

---

## 🏛️ System Architecture

CraftSquad unifies the global standards of AI software development into a seamless, automated pipeline:
1. **Personas & SOPs:** Authentic **BMAD-METHOD** personas (Sofia, Winston, Sally, Amelia, Oliver).
2. **Artifact Standards:** Authentic **GitHub Spec-Kit** formats (`constitution.md`, `spec.md`, `plan.md`, `tasks.md`).
3. **Execution Engine:** **CraftSquad Multi-Engine Dispatcher** dynamically routing tasks to specialized engines (OpenAI Codex, Claude Code, Antigravity Gemini Flash).

---

## 👥 The Squad Matrix & Reasoning Effort Defaults

Configured dynamically in `squad.config.json`:

| Role | Persona | Engine | Model | Default Reasoning Effort | Prompt Override Example |
|---|---|---|---|---|---|
| **Scrum Master & PO** | Sofia | **Gemini** | `gemini-3.8-flash` | **`high`** (Default for Gemini) | `[effort: low]` |
| **System Architect** | Winston | **Codex** | `gpt-6.1-sol` | **`medium`** | `[effort: high]` |
| **Lead UX/UI Designer** | Sally | **Codex** | `gpt-6-astra` | **`medium`** | `[effort: high]` |
| **Full-Stack Developer** | Amelia | **Claude** | `claude-3-7-sonnet-latest` | **`medium`** | `[effort: high]` |
| **Adversarial Reviewer** | Oliver | **Codex** | `gpt-6.1-sol` | **`medium`** | `[effort: high]` |
| **QA Test Engineer** | Tester | **Gemini** | `gemini-3.8-flash` | **`high`** (Default for Gemini) | `[effort: medium]` |
| **QA Gatekeeper** | Gatekeeper | **CLI** | Configurable (e.g. `npm test`) | N/A (Deterministic) | N/A |

> **Reasoning Effort Rules:**
> 1. Roles utilizing **Gemini 3.8 Flash** default to **`high`**.
> 2. Other roles default to **`medium`**.
> 3. Any role can be overridden on the fly by appending `[effort: high]`, `[effort: medium]`, `[effort: low]`, or `[effort: xhigh]` directly into the prompt.

---

## ⚡ Available Commands & Skills

* `/bmad-sprint`: Sofia breaks down PRD and creates user stories in GitHub Spec-Kit format.
* `/bmad-architect`: Winston designs schema deltas and API contracts.
* `/bmad-ui`: Sally produces presentational UI skeletons and responsive components.
* `/bmad-dev`: Amelia implements business logic according to frozen contracts.
* `/bmad-review`: Oliver performs adversarial code review finding edge cases.
* `/bmad-qa`: Gatekeeper verifies compiler, tests, and build scripts (exit code 0).
* `/bmad-rescue`: Escalates stuck debugging loops to frontier reasoning.
