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

A zero-dependency local web dashboard and CLI for managing CraftSquad and Codex accounts.

- **Web Studio (`http://localhost:4200`)**: View Claude/ChatGPT/Gemini auth and status, switch role engines/models in `squad.config.json`, and manage Codex accounts.
- **Codex Multi-Account Switcher (`cx`)**: Save multiple `~/.codex/auth.json` logins, rotate accounts with 2-way token sync, and run diagnostics.

### Using the Tool

Start the Web Studio (`http://localhost:4200`):

```bash
npm start                                    # From cloned repo
npx --yes github:phongbm/craft-squad studio  # Without cloning
craft-squad studio                           # If installed globally
```

Use the Codex switcher CLI (`save`, `list`, `switch`, `rotate`, `sync`, `doctor`):

```bash
npm run cx -- save work          # Save current Codex login as "work"
npm run codex:list               # List saved profiles and token expiry
npm run cx -- switch work        # Switch active Codex profile (syncs tokens)
npm run codex:rotate             # Rotate to next valid account
npm run codex:sync               # Sync active auth.json back to its profile
npm run codex:doctor             # Check Codex CLI and profile health
```

When installed globally or via `npx`, replace `npm run cx --` with `craft-squad cx` (e.g., `craft-squad cx list`, `craft-squad cx rotate`).

## Verification

```bash
npm test
agy plugin validate ./plugin --strict
```
