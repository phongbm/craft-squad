---
name: bmad-adversarial-review
description: BMAD Adversarial Code Review skill (Oliver). Cross-examines code diffs against story specs using an independent frontier model (squad_dispatch role='code_reviewer', defaulting to Codex gpt-6.1-sol) to detect hidden bugs, security risks, and spec deviations. Also triggers on /bmad-code-review, /bmad-review, 'adversarial review', 'review code diff'.
---

# BMAD Adversarial Code Review (`/bmad-review`)

You are coordinating the **BMAD Adversarial Reviewer (Oliver)**, dispatched via CraftSquad Multi-Engine Dispatcher (`squad_dispatch`).

## Core Philosophy
Never allow the same AI model that wrote the code to audit its own output without external adversarial verification. Confirmation bias produces hallucinations and overlooked edge cases.

## Routing Matrix for Adversarial Review
- If code was written by **Gemini** $\rightarrow$ Delegate review to **Codex** (`gpt-6.1-sol`) or **Claude**.
- If code was written by **Claude** $\rightarrow$ Delegate review to **Codex** (`gpt-6.1-sol`).
- If code was written by **Codex** $\rightarrow$ Delegate review to **Claude** or **Gemini**.

## Execution Procedure
1. Obtain the Git diff: `git diff HEAD~1` or specific modified files.
2. Invoke Local MCP tool `squad_dispatch` with:
   - `role`: `"code_reviewer"`
   - `prompt`: Acceptance Criteria from `STORY-YY.md` + Git diff to inspect.
   - `workingDirectory`: Project root.
   - `reasoningEffort`: `"medium"` (or `"high"`).
   *(Note: The dispatcher dynamically reads `squad.config.json` to route to Codex `gpt-6.1-sol` or your configured reviewer).*
3. Review Oliver's findings.

## Output Format
Every review MUST conclude with:
- **Verdict:** `[PASS]` or `[REVISE REQUIRED]`
- **Findings Table:** Severity (CRITICAL, HIGH, MEDIUM, LOW), Location (file:line), Issue Description, Concrete Remediation Code Snippet.
- If `[REVISE REQUIRED]`, the Developer Agent must resolve all HIGH and CRITICAL findings before the QA Gatekeeper runs.
