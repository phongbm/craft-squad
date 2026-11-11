# CraftSquad: Role-Based Multi-Agent Team for Antigravity & Management Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version: 3.1.0](https://img.shields.io/badge/Version-3.1.0-brightgreen.svg)](plugin/package.json)
[![Antigravity](https://img.shields.io/badge/Antigravity-Plugin%20Compatible-blueviolet.svg)](https://antigravity.google)
[![Tests: 27 Passed](https://img.shields.io/badge/Tests-27%20Passed%20(100%25)-success.svg)](plugin/scripts/test_dispatcher.js)

> **CraftSquad** is an engineering multi-agent team protocol and plugin for **Google Antigravity**, pairing **Claude Code CLI** (Full-Stack Developer & Architect), **OpenAI Codex CLI** (Adversarial Code Reviewer), and **Google Gemini** (Host Orchestrator, Spec Owner & E2E Tester).

---

## 📂 Repository Architecture

This repository is organized as a clean, production-ready monorepo ready for GitHub:

```text
craft-squad/
├── plugin/                          # 📦 The official Antigravity Plugin
│   ├── agents/                      # Native Subagents (cs-spec-owner, cs-tester, etc.)
│   ├── bin/cli.js                   # CLI Dispatcher and Plugin Lifecycle Manager
│   ├── charters/                    # Explicit Role Charters (Developer, Reviewer, etc.)
│   ├── mcp-server/                  # Stdio MCP Server (squad_dispatch, squad_set_role)
│   ├── rules/AGENTS.md              # Always-on Dual-Track Triage & Batch Delivery Protocol
│   ├── templates/                   # Upstream BMAD-METHOD & GitHub Spec-Kit templates
│   ├── plugin.json                  # Antigravity Plugin Manifest (v3.1.0)
│   ├── package.json                 # Plugin NPM Package
│   └── squad.config.json            # Configuration-driven Role & Engine mapping
│
├── tool/                            # 🚀 Local Web Management Tool (Zero Dependencies)
│   ├── server.js                    # Native Node.js HTTP & REST API server (port 4200)
│   ├── bin/
│   │   └── cx.js                    # Standalone CLI tool for Codex profile switching
│   ├── lib/
│   │   ├── squad-manager.js         # Reads and updates squad.config.json
│   │   ├── codex-manager.js         # Built-in native Codex multi-account manager & sync engine
│   │   └── quota-monitor.js         # Multi-engine quota & auth inspector
│   └── public/                      # Modern Dark-Mode Dashboard (HTML5 / CSS3 / Vanilla JS)
│
├── package.json                     # Monorepo root coordinator
└── README.md                        # Documentation
```

---

## ⚡ Key Highlights (v3.1.0)

### 1. Dual-Track Task Triage
- **Route 0 (Direct Fast-Track)**: Localized bugfixes, styling/CSS tweaks, configuration updates, or specific change instructions are handled **directly by the Host Agent (Gemini 3.8 Flash)** using file tools in **seconds**, bypassing heavy CLI ceremony.
- **Route A/B/C/D (Agent Team Track)**: New features and complex initiatives follow the structured Agent Team pipeline.

### 2. Single-Batch Delivery Loop (No Micro-turn Lag)
- **Spec Owner**: Decomposes initiatives into lean Epics (`EPIC-<ID>.md`) and Atomic Stories (`STORY-<ID>.md`) to define boundaries, Input/Output, and Given-When-Then criteria.
- **Batch Developer (Claude Code CLI)**: Dispatched once (`--epic=path/to/epic.md`) to implement **all stories in a single turn**, preserving context across files.
- **Batch Reviewer (OpenAI Codex CLI)**: Dispatched once to audit the **entire aggregate diff in a single turn**.
- **E2E Tester (Gemini Subagent)**: Executes live runtime & **Browser Subagent (`/browser`)** verification across the entire feature suite.

### 3. Web Studio, Native Codex Switcher & Quota Monitor (`tool/`)
- **Role Model Switcher**: Real-time web UI to swap engines (Claude, Codex, Gemini, CLI), models, and reasoning effort per role in `squad.config.json`.
- **Built-in Native Codex Switcher**: 100% self-contained multi-account engine (`tool/lib/codex-manager.js`) and standalone CLI (`tool/bin/cx.js`), ported directly from `chatgpt-codex-switcher` with zero external runtime dependencies. Features Bi-directional Token Sync (Sync-on-Switch), fast account rotation, safe atomic file writes, and daemon control.
- **Live AI Quota Monitor**: Live health tracking for Claude (subscription tier, rate limit tiers), ChatGPT (token expiry countdown and standby pool), and Gemini (language server status).

---

## 🚀 Quick Start

### 1. Run the Local Management Tool
Start the local dashboard with zero external dependencies:
```bash
npm start
# or
node tool/server.js
```
Open **`http://localhost:4200`** in your browser.

### 2. Run Tests
Verify all 27 unit tests and dispatch routing:
```bash
npm run plugin:test
```

### 3. Install Plugin into Antigravity
Deploy the clean plugin into Antigravity global plugin directory (`~/.gemini/config/plugins/craft-squad`):
```bash
npm run plugin:install
```

To update when source changes:
```bash
npm run plugin:upgrade
```

---

## 🔒 Security & Privacy
- **100% Local & Private**: All profile switches and token management run strictly on your local machine (`~/.codex/`, `~/.claude.json`). No external telemetry or cloud dependencies.
- **Safe Atomic Operations**: Configuration updates and token swaps use atomic file replacements to prevent corruption.

---

## 📄 License
MIT License. Built with pride by **CraftXTech Team**.
