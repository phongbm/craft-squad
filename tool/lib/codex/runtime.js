/**
 * CraftSquad Tool - Codex CLI runtime helpers: binary lookup, daemon restart, process detection, browser sign-in.
 * Override the binary with CX_CODEX_BIN (used by tests).
 */

const fs = require('fs');
const path = require('path');
const { run, resolveBin, spawnProc } = require('../proc');

async function findCodexBinary() {
  if (process.env.CX_CODEX_BIN) return process.env.CX_CODEX_BIN;
  const found = await resolveBin('codex');
  if (found) return found;
  const localAppData = process.platform === 'win32' ? process.env.LOCALAPPDATA : null;
  if (localAppData) {
    const binDir = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
    if (fs.existsSync(binDir)) {
      for (const sub of fs.readdirSync(binDir).sort().reverse()) {
        const candidate = path.join(binDir, sub, 'codex.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    const direct = path.join(localAppData, 'OpenAI', 'Codex', 'codex.exe');
    if (fs.existsSync(direct)) return direct;
  }
  return null;
}

async function codexVersion() {
  const bin = await findCodexBinary();
  if (!bin) return null;
  const res = await run(bin, ['--version'], { timeout: 5000 });
  return res.code === 0 && res.stdout ? res.stdout.split(/\r?\n/)[0] : null;
}

async function restartDaemon() {
  const bin = await findCodexBinary();
  if (!bin) return { success: false, message: 'Codex CLI not found.' };
  const res = await run(bin, ['app-server', 'daemon', 'restart'], { timeout: 15000 });
  if (res.code === 0) return { success: true, message: res.stdout || 'Daemon restarted.' };
  return { success: false, message: res.timedOut ? 'Daemon restart timed out.' : 'Daemon restart failed or the daemon is not running.' };
}

/** Number of running Codex processes, so the UI can suggest restarting open windows. */
async function codexProcessCount() {
  if (process.platform === 'win32') {
    const res = await run('tasklist', ['/FI', 'IMAGENAME eq codex.exe', '/FO', 'CSV', '/NH'], { timeout: 5000 });
    return (res.stdout.match(/codex\.exe/gi) || []).length;
  }
  const res = await run('pgrep', ['-x', 'codex'], { timeout: 5000 });
  return res.code === 0 ? res.stdout.split(/\r?\n/).filter(Boolean).length : 0;
}

/** Start `codex login` against an isolated CODEX_HOME so the live login is never touched. */
function startLogin(bin, codexHome) {
  return spawnProc(bin, ['login'], { env: { ...process.env, CODEX_HOME: codexHome }, stdio: ['ignore', 'pipe', 'pipe'] });
}

module.exports = { findCodexBinary, codexVersion, restartDaemon, codexProcessCount, startLogin };
