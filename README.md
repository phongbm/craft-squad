# CraftSquad

Zero-dependency Antigravity multi-agent team plugin (`plugin/`) and local management tool (`tool/`).

## Plugin Features

CraftSquad coordinates specialized roles across multiple AI engines in Google Antigravity:

- **Multi-Engine Roles**:
  - **Gemini**: `spec_owner` (Epics/Stories), `scrum_master` (triage & orchestration), `tester` (live E2E/browser verification)
  - **Claude Code CLI**: `architect` (technical plans/contracts), `developer` (implementation)
  - **OpenAI Codex CLI**: `ui_designer` (UI structure), `code_reviewer` (adversarial diff audit), `rescue` (root-cause fixes)
  - **CLI Gate**: `qa_gatekeeper` (deterministic test/build command; exit code `0` required)
- **Dual-Track Workflow**:
  - **Direct Fast-Track**: Small, targeted edits (1–2 files) execute directly without extra orchestration overhead.
  - **Agent Team Track**: Complex features run through `Spec -> Batch Developer -> Batch Reviewer -> E2E Tester -> QA Gatekeeper`, pausing for human input only on major architectural/UX changes, scope violations, or repeated failures.
- **Configurable Routing**: Engines, models, reasoning effort, and gate commands live in `squad.config.json`.

## Plugin Setup

**Prerequisites**: Node.js `>= 18`, Google Antigravity, plus `claude` (`@anthropic-ai/claude-code`) and `codex` (`@openai/codex`) CLIs authenticated for external roles.

### Install

**Quick install from GitHub (no `git clone` required):**

```bash
npx --yes github:phongbm/craft-squad install
```

Or install globally once to get the `craft-squad` command anywhere:

```bash
npm i -g git+https://github.com/phongbm/craft-squad.git
craft-squad install
```

**From a local clone:**

```bash
git clone https://github.com/phongbm/craft-squad.git
cd craft-squad
npm run plugin:install
# Or via Antigravity CLI:
agy plugin install ./plugin
```

### Update

- Without cloning (or global npm install):

  ```bash
  npx --yes github:phongbm/craft-squad install
  # Or if installed globally via npm i -g:
  npm i -g git+https://github.com/phongbm/craft-squad.git && craft-squad install
  ```

- From a cloned repo (pulls latest commits when working tree is clean, then redeploys):

  ```bash
  npm run plugin:update
  # Redeploy local edits without git pull:
  npm run plugin:update -- --no-pull
  ```

### Uninstall

Stops CraftSquad's MCP server, removes `~/.gemini/config/plugins/craft-squad`, and cleans `~/.gemini/config/config.json`:

```bash
npx --yes github:phongbm/craft-squad uninstall
# Or from a cloned repo / global install / Antigravity CLI:
npm run plugin:uninstall
craft-squad uninstall
agy plugin uninstall craft-squad
```

## Using the Plugin

Check engine availability and current role mapping:

```bash
craft-squad status          # or: npm run plugin:status
craft-squad config          # or: npm run plugin:config
```

Update a role's engine, model, or effort (in current project or repo):

```bash
craft-squad config set developer claude sonnet medium
```

Initialize a project-specific `squad.config.json` in any repository:

```bash
cd /path/to/project
npx --yes github:phongbm/craft-squad init
# Or if installed globally:
craft-squad init
```

In Antigravity, prompt the squad directly (e.g., *"Write the spec for this feature with Spec Owner, then hand it to Scrum Master"*).

## Local Management Tool (`tool/`)

A zero-dependency local web Studio for managing Codex and Claude Code accounts and the squad's role-to-engine mapping. Accounts are identified by email; there are no aliases to invent.

```bash
npm start                                    # From cloned repo: http://localhost:4200
npx --yes github:phongbm/craft-squad studio  # Without cloning
craft-squad studio                           # If installed globally
```

- **Accounts tab**: add an account (browser sign-in), switch Codex's live login, choose which Claude account CraftSquad dispatch uses, remove accounts, run diagnostics.
- **Squad roles tab**: pick engine, model, and reasoning effort per role (`squad.config.json`).
- **Safe by default**: listens on `127.0.0.1` only, requires a per-session token, and never exposes tokens in the UI or API.

**Codex** accounts are saved in `~/.craft-squad/codex-profiles/<email>/`. Switching copies the chosen account to `~/.codex/auth.json` (after saving and backing up the current login) and restarts the Codex daemon. **Claude Code** accounts each get their own `CLAUDE_CONFIG_DIR` in `~/.craft-squad/claude-profiles/<email>/`, so tokens are never copied; the account marked "In use" is the one squad dispatch runs Claude Code with.

Prefer the terminal? The same actions are available through `cx` (select accounts by email, an email prefix, or list number):

```bash
npm run cx -- list                  # Codex accounts
npm run cx -- add                   # Sign in a new Codex account
npm run cx -- switch me@work.com    # Switch the live Codex login
npm run cx -- claude list           # Claude Code accounts
npm run cx -- claude add            # Sign in a new Claude account
npm run cx -- claude use me@work.com
npm run cx -- claude run me@work.com   # Start Claude Code as that account
```

When installed globally or via `npx`, replace `npm run cx --` with `craft-squad cx`. Use accounts you are entitled to (for example personal vs work); rotating accounts to evade rate limits may violate provider terms. On macOS, Claude credentials live in the Keychain: verify per-account isolation before relying on it.

## Credits

CraftSquad's spec-driven workflow is inspired by [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) and [GitHub Spec-Kit](https://github.com/github/spec-kit) (both MIT). All templates and charters in this repo are original, concise rewrites.

## Verification

```bash
npm test
agy plugin validate ./plugin --strict
```
