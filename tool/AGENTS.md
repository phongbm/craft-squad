# CraftSquad Local Tool (`tool/`)

Zero-dependency local web Studio (`http://localhost:4200`) and account CLI (`cx`) for Codex and Claude Code. Accounts are identified by email; there are no aliases.

## Layout

- `server.js` — Bootstrap: loopback bind, wires services into the HTTP layer.
- `lib/http.js` — Security and transport: Host allow-list, same-origin check, per-boot `X-CS-Token`, JSON-only bodies, CSP, body limit, static files, error mapping.
- `lib/api.js` — JSON routes (`/api/accounts…`, `/api/doctor/:provider`, `/api/status`, `/api/config…`). Handlers return objects or throw `ApiError`.
- `lib/account-store.js` — Shared store: id = email slug, derived identity matching, selectors (id, number, email prefix), alias-to-id migration.
- `lib/codex/` — `auth.js` (JWT identity, no token output), `store.js` (`CodexService`: save/switch/rotate/sync/backup, derived active account), `runtime.js` (binary, daemon, isolated sign-in).
- `lib/claude/` — `store.js` (`ClaudeService`: one `CLAUDE_CONFIG_DIR` per account, "System default" entry, selected account), `runtime.js`.
- `lib/pending.js` — Registry of browser sign-ins (`codex login`, `claude auth login`) started from the UI/CLI.
- `lib/proc.js` — Safe process spawning (no `shell: true`; Windows `.cmd` shims escaped). `lib/fs-utils.js` — atomic writes, 0600/0700 modes, slugs.
- `lib/squad-manager.js` — Reads/updates `squad.config.json` (role validation; model presets come from the config itself). `lib/engine-status.js` — async, cached CLI version probes.
- `bin/cx.js`, `bin/cx-claude.js`, `bin/cx-util.js` — Thin CLI over the same services.
- `public/` — Vanilla UI: `index.html`, `styles.css`, `js/` ES modules (`main`, `accounts`, `roles`, `ui`, `dom`, `api`, `icons`). No build step, no CDN, no inline scripts or styles (CSP).
- `test/` — Offline suite (`node tool/test/run.js`, also run by root `npm test`) using stub CLIs in `test/stubs/`.

## Behavior to preserve

- **Codex active account is derived** from the live `~/.codex/auth.json` identity, never from stored state. Sync-back copies tokens only into the account with the same identity. Switching saves an unsaved live login first and keeps the last 3 backups in `<root>/.backup/`.
- **Claude accounts are isolated config dirs** under `~/.craft-squad/claude-profiles/<email>/` (`CX_CLAUDE_HOME`). The account marked in use (`state.json` `active_id`) is read by the plugin dispatcher (`plugin/mcp-server/modules/claude-account.js`) to set `CLAUDE_CONFIG_DIR`. Never copy tokens between accounts.
- Saved Codex accounts live in `~/.craft-squad/codex-profiles/<email>/` (`CX_CODEX_HOME`); legacy `<CODEX_HOME>/profiles` and alias-named folders are migrated once, never overwriting.

## Commands & Verification

```bash
npm start                     # Web Studio on http://localhost:4200 (PORT overrides; binds 127.0.0.1)
npm run cx -- --help          # cx commands
npm run tool:test             # Tool suite only
```

- Syntax check edited JS with `node --check <file>`.
- Tests and manual runs must be sandboxed: set `CODEX_HOME`, `CX_CODEX_HOME`, `CX_CLAUDE_HOME`, `CX_CLAUDE_SYSTEM_DIR` to temp dirs and `CX_CODEX_BIN` / `CX_CLAUDE_BIN` to the stubs. Never run switch/remove against the real home while developing.

## Invariants

- **Zero Dependencies**: Node.js built-ins and vanilla frontend only.
- **Atomic, private writes**: temp file + rename; credential files 0600, directories 0700.
- **Credential Safety**: Never log, print, return from the API, or commit tokens or the contents of `~/.codex`, `~/.claude.json`, `~/.claude/.credentials.json`, or profile directories. Return identity metadata only.
- **Local-only API**: Do not add CORS headers, accept directory input from clients, or bind beyond loopback.
- **No innerHTML in the UI**: build DOM with `js/dom.js` (`textContent`), so account data cannot inject markup.
