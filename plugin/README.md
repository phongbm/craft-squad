# CraftSquad

Role-based autonomous agent team plugin for Google Antigravity with multi-engine routing (`gemini`, `claude`, `codex`, `cli`), dual-track triage, and adversarial quality gates.

## Requirements

- Node.js `>= 18`
- Authenticated `claude` (`@anthropic-ai/claude-code`) and `codex` (`@openai/codex`) CLIs for external developer/reviewer roles

## Quick Usage

- Prompt the squad in Antigravity (e.g., *"Write the spec for this feature with Spec Owner, then hand it to Scrum Master"*).
- Customize engines, models, and gate commands per project by creating `squad.config.json` in your repository root (`node bin/cli.js init` from the plugin directory).
- Check status or edit role mappings: `node bin/cli.js status` / `node bin/cli.js config`.
