# Handoff Prompt for Codex Architectural Planning (Paste into Codex App)

```text
Feature being planned: [<FEATURE_NAME_OR_SLUG>]
Initial Requirements / PRD:
[PASTE CONTENT FROM .agents/features/<slug>/01_PRD.md HERE]

You are the Lead System Architect & Product Strategist (GPT-Frontier). Create a comprehensive architectural task plan for this feature.
IMPORTANT REQUIREMENTS:
1. DO NOT WRITE COMPLETE CODE. Focus on structural breakdown, domain logic, and state flow.
2. Update or generate .agents/features/<slug>/03_TASKS.md using granular model delegation:
   - For UI/UX markup and styling tasks, tag: [DELEGATE: CODEX-UI]
   - For complex domain algorithms or state machines, tag: [DELEGATE: CODEX-LOGIC] (include pseudocode/spec)
   - For standard implementation, state wiring, API connections, tag: [DELEGATE: GEMINI-DEV]
   - Always include the final gates: [DELEGATE: GEMINI-REVIEW] and [DELEGATE: GEMINI-QA].
3. STRICTLY PROHIBITED: Do not run `git checkout` to switch branches.
4. Once completed, commit with prefix: [CODEX-PLAN](<slug>): architectural task breakdown
```
