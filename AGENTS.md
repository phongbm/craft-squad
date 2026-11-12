# CraftSquad Workspace

Monorepo containing the **CraftSquad** Antigravity plugin (`plugin/`) and local management tool (`tool/`).

## Layout & Guides

- `plugin/` — Antigravity multi-agent team plugin (`bin/`, `mcp-server/`, `agents/`, `charters/`, `rules/AGENTS.md`, `templates/`, `scripts/`). Dev guide is the "Plugin Development" section below; runtime plugin rules are in [plugin/rules/AGENTS.md](plugin/rules/AGENTS.md).
- `tool/` — Local web studio (`http://localhost:4200`) and account CLI (`cx`) for Codex and Claude Code, identified by email. See [tool/AGENTS.md](tool/AGENTS.md).

## Root Commands

| Command | Purpose |
|---|---|
| `npm test` | Run both offline suites: plugin (`plugin/scripts/test_dispatcher.js`) and tool (`tool/test/run.js`) |
| `npm start` | Launch CraftSquad Web Studio at `http://localhost:4200` |
| `npm run cx -- <cmd>` | Account CLI (by email, no aliases): Codex (`list`, `add`, `save`, `switch`, `rotate`, `remove`, `sync`, `doctor`) or `claude list/add/use/run/env/remove/doctor` |
| `npm run plugin:install` | Deploy `plugin/` to `~/.gemini/config/plugins/craft-squad` |
| `npm run plugin:update` | Pull git updates (`--no-pull` to skip) and redeploy plugin |
| `npm run plugin:uninstall` | Stop CraftSquad MCP server, remove installed plugin, clean `config.json` |
| `npm run plugin:status` | Check `claude`/`codex` CLI availability and active role mappings |
| `npm run plugin:config` | Inspect or set role mappings in `squad.config.json` |

## Plugin Development (`plugin/`)

Antigravity multi-agent team plugin with config-driven engine routing (`gemini`, `claude`, `codex`, `cli`).

### Layout

- `plugin.json`, `mcp_config.json`, `squad.config.json`, `squad.schema.json` — Plugin manifest, MCP server config, role/model defaults, and schema.
- `bin/cli.js` — CLI for `install`, `update`/`upgrade`, `uninstall`, `init`, `config`, `status`, `dispatch`, `studio`, and `cx`.
- `mcp-server/` — Stdio JSON-RPC 2.0 server (`index.js`, `shared/rpc.js`, `shared/logger.js`) and dispatch modules (`modules/dispatcher.js`, `modules/prompt-compiler.js`).
- `rules/AGENTS.md` — Always-on Antigravity plugin runtime protocol (Dual-Track Triage & Batch Delivery).
- `agents/` — 8 native Antigravity subagent definitions (`cs-*.md`).
- `charters/` — 9 role charters (mission, duties, boundaries, persona) injected into prompts at runtime.
- `templates/craftsquad/` — Epic/Story/Spec/Plan/Tasks/Checklist/Bug templates and `review/` lenses, selected via `artifactType` / `ROLE_SOURCES`.
- `scripts/` — Offline test suite (`test_dispatcher.js`).

### Commands & Verification

```bash
npm test                                  # Offline test suite
agy plugin validate ./plugin --strict     # Antigravity plugin validation
node plugin/bin/cli.js status             # Check CLIs and active role mapping
node plugin/bin/cli.js dispatch developer "check" --dry
```

### Invariants

- **No Hardcoded Models**: Never put model IDs or hardcoded engine names in `rules/AGENTS.md`, `agents/*.md`, or `charters/*.md` (enforced by `npm test`). Bindings live in `squad.config.json`.
- **Role Parity**: Every role in `squad.config.json` requires `charters/<role>.md` and `agents/cs-*.md` (except CLI-only `qa_gatekeeper`).
- **Template Parity**: Every file referenced by `ROLE_SOURCES` in `mcp-server/modules/prompt-compiler.js` must exist under `templates/craftsquad/` (enforced by `npm test`). Keep templates and charters self-contained; no third-party template trees.
- **Clean Deploy Allowlist**: `copyCleanPlugin()` in `bin/cli.js` defines what deploys to `~/.gemini/config/plugins/craft-squad`; dev docs (this root `AGENTS.md`) stay out of the deployed copy (the plugin root holds no `AGENTS.md`; `agy plugin validate --strict` rejects it) while `rules/AGENTS.md` provides runtime plugin rules.

## Engineering Standards

- **Zero External Dependencies**: Both `plugin/` and `tool/` use only Node.js (`>= 18`) built-ins and vanilla HTML/CSS/JS.
- **Atomic File Writes**: Config (`squad.config.json`) and auth (`~/.codex/auth.json`, Claude profile state) updates must write to a temp file and atomically rename.
- **English Only & Focused Modules**: Keep code, docs, and templates concise, modular, and in English.
- **Verification Gate**: Run `npm test` (and `agy plugin validate ./plugin --strict`) before finishing changes.
