/**
 * CraftSquad Tool - Claude Code CLI helpers. Override the binary with CX_CLAUDE_BIN (used by tests).
 */

const { run, resolveBin, spawnProc } = require('../proc');

async function findClaudeBinary() {
  if (process.env.CX_CLAUDE_BIN) return process.env.CX_CLAUDE_BIN;
  return resolveBin('claude');
}

async function claudeVersion() {
  const bin = await findClaudeBinary();
  if (!bin) return null;
  const res = await run(bin, ['--version'], { timeout: 5000 });
  return res.code === 0 && res.stdout ? res.stdout.split(/\r?\n/)[0] : null;
}

/** Start `claude auth login` bound to an isolated CLAUDE_CONFIG_DIR. */
function startLogin(bin, configDir, email) {
  const args = ['auth', 'login'];
  if (email) args.push('--email', email);
  return spawnProc(bin, args, { env: { ...process.env, CLAUDE_CONFIG_DIR: configDir }, stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Run Claude Code interactively (used by `cx claude run`). A null configDir means the system default login:
 * CLAUDE_CONFIG_DIR must then be unset, because pointing it at ~/.claude would make Claude Code look for
 * .claude.json inside that folder instead of ~/.claude.json and appear signed out.
 */
function runInteractive(bin, configDir, args) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (configDir) env.CLAUDE_CONFIG_DIR = configDir; else delete env.CLAUDE_CONFIG_DIR;
    const child = spawnProc(bin, args, { env, stdio: 'inherit' });
    child.on('error', (err) => resolve({ code: 1, error: err }));
    child.on('close', (code) => resolve({ code: code === null ? 1 : code }));
  });
}

module.exports = { findClaudeBinary, claudeVersion, startLogin, runInteractive };
