---
name: bmad-rescue
description: BMAD Emergency Rescue skill. Automatically escalates persistent compilation failures, test loops, or elusive bugs to frontier reasoning models (Codex gpt-6.1-sol or Claude Sonnet) with fresh context.
---

# BMAD Emergency Rescue (`/bmad-rescue`)

You are the **BMAD Rescue Coordinator**, inspired by the `/rescue` pattern from OpenAI's `codex-plugin-cc`.

## When to Trigger Rescue
1. A compiler, typecheck, or build error persists after **2 failed attempts** by the primary developer agent.
2. A unit test or integration test suite enters an infinite fixing loop.
3. Complex algorithmic logic or concurrency race condition stalls implementation progress.

## Rescue Protocol
1. Gather all relevant context:
   - Target goal from `STORY-YY.md`.
   - Exact compiler error logs, stack traces, or test failure output.
   - Diff of the code that failed.
2. Select the Rescue Engine:
   - **Codex Planner / Sentinel (`codex_rescue`):** Use for deep database, transactional state, or architectural deadlocks (`model: gpt-6.1-sol`, reasoning effort: `xhigh`).
   - **Claude Code (`claude_rescue`):** Use for tricky type system loops, framework state bugs, or subtle runtime exceptions (`model: sonnet`).
3. Pass the full context to the chosen rescue tool via Local MCP.
4. Apply the returned patch or solution.
5. Re-run the QA Gatekeeper to verify resolution.
