---
name: architect-router
description: >-
  System architecture and task routing skill. Evaluates whether planning requires Codex or Gemini,
  and breaks down features into granular tasks tagged by optimal model capability.
---

# Architect & Router Runbook

## 1. Dual-Engine Planning Matrix

| Criteria | Gemini Planner (Local) | Codex Planner (Frontier) |
|---|---|---|
| **Problem Complexity** | Low to medium; clear established patterns. | High; multi-tiered domain logic, abstract systems. |
| **Scope of Change** | Localized (1-3 files), bugfixes, standard CRUD. | New subsystems, novel data flows, full UI/UX design. |
| **Latency & Overhead** | Instant (2s), 0 handoff steps. | Requires one copy-paste step via Codex app. |

## 2. Granular Task Tagging Matrix

When authoring `03_TASKS.md`, assign each task to the model best suited for it:

| Allocation Tag | Assigned Model | Scope of Work |
|---|:---:|---|
| `[DELEGATE: CODEX-UI]` | Codex Astra | Presentational JSX/HTML/Widget skeletons, Tailwind classes, responsive breakpoints, Props interface. |
| `[DELEGATE: CODEX-LOGIC]` | Codex Astra | Complex algorithms, state machine transitions, multi-step data pipelines (pseudocode/spec). |
| `[DELEGATE: GEMINI-DEV]` | Gemini Flash | Implementation: assembling UI + Logic, state wiring, API integration, validation. *(No testing/building)*. |
| `[DELEGATE: GEMINI-REVIEW]` | Gemini Flash | Audits code diff against UI Spec and PRD; checks clean code & security standards. |
| `[DELEGATE: GEMINI-QA]` | Gemini Flash | Runs `npx tsc --noEmit`, `npm run lint`, `npm run build` (or mobile equivalents). |
| `[DELEGATE: GEMINI-UNIT-TEST]` | Gemini Flash | Authors `*.test.ts` / `*_test.dart` and executes test runner on-demand. |
