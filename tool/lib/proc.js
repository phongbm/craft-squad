/**
 * CraftSquad Tool - safe child-process helpers (zero dependencies).
 * Never uses `shell: true`. Windows .cmd/.bat shims are launched through cmd.exe with
 * explicit argument escaping so user-supplied arguments cannot inject commands.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';
const META_CHARS = /([()\][%!^"`<>&|;, *?])/g;
const binCache = new Map();

function escapeCommand(arg) {
  return arg.replace(META_CHARS, '^$1');
}

function escapeArgument(arg, doubleEscape) {
  let out = `${arg}`;
  out = out.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  out = out.replace(/(?=(\\+?)?)\1$/, '$1$1');
  out = `"${out}"`;
  out = out.replace(META_CHARS, '^$1');
  if (doubleEscape) out = out.replace(META_CHARS, '^$1');
  return out;
}

/**
 * Turn (bin, args) into a spawn() triple that is safe on every platform.
 * @returns {{ file: string, args: string[], options: object }}
 */
function buildSpawn(bin, args = []) {
  const list = args.map(String);
  if (/\.(c|m)?js$/i.test(bin)) return { file: process.execPath, args: [bin, ...list], options: {} };
  if (IS_WIN && /\.(cmd|bat)$/i.test(bin)) {
    const shellCommand = [escapeCommand(path.normalize(bin))].concat(list.map((a) => escapeArgument(a, true))).join(' ');
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `"${shellCommand}"`],
      options: { windowsVerbatimArguments: true }
    };
  }
  return { file: bin, args: list, options: {} };
}

function spawnProc(bin, args = [], options = {}) {
  const built = buildSpawn(bin, args);
  return spawn(built.file, built.args, { windowsHide: true, ...built.options, ...options });
}

/** Run a command to completion. Never rejects. */
function run(bin, args = [], { timeout = 15000, env, cwd, input } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnProc(bin, args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      return resolve({ code: null, stdout: '', stderr: err.message, error: err, timedOut: false });
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), timedOut, ...result });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch (_) {}
    }, timeout);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (error) => finish({ code: null, error }));
    child.on('close', (code) => finish({ code }));
    if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  });
}

/** Locate an executable on PATH. Prefers real executables over extensionless shell shims on Windows. */
async function resolveBin(name) {
  const key = `${name}\0${process.env.PATH}`;
  if (binCache.has(key)) return binCache.get(key);
  const res = await run(IS_WIN ? 'where' : 'which', [name], { timeout: 5000 });
  let found = null;
  if (res.code === 0 && res.stdout) {
    const lines = res.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && fs.existsSync(l));
    if (IS_WIN) {
      // First runnable match in PATH order; extensionless entries are POSIX-style shims cmd.exe cannot run.
      found = lines.find((l) => /\.(exe|cmd|bat)$/i.test(l)) || null;
    } else {
      found = lines[0] || null;
    }
  }
  if (found) binCache.set(key, found);
  return found;
}

function clearBinCache() {
  binCache.clear();
}

module.exports = { buildSpawn, spawnProc, run, resolveBin, clearBinCache, escapeArgument };
