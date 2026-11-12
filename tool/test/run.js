#!/usr/bin/env node
// Tool test suite. Runs fully offline inside a sandbox; stub CLIs replace codex and claude.

const fs = require('fs');
const os = require('os');
const path = require('path');

// Safety net: anything that falls back to default locations lands in a throwaway home, never the real one.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-tool-home-'));
Object.assign(process.env, {
  HOME: home,
  USERPROFILE: home,
  CODEX_HOME: path.join(home, '.codex'),
  CX_CODEX_HOME: path.join(home, 'codex-profiles'),
  CX_CLAUDE_HOME: path.join(home, 'claude-profiles'),
  CX_CLAUDE_SYSTEM_DIR: path.join(home, '.claude'),
  CX_CODEX_BIN: path.join(__dirname, 'stubs', 'codex-stub.js'),
  CX_CLAUDE_BIN: path.join(__dirname, 'stubs', 'claude-stub.js')
});

const { runAll } = require('./harness');
for (const file of ['proc', 'accounts', 'server', 'cli']) require(`./${file}.test.js`);

runAll().then(() => fs.rmSync(home, { recursive: true, force: true }));
