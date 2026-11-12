/**
 * CraftSquad - safe process spawning for engine CLIs (zero dependencies).
 * Windows .cmd/.bat shims are launched through cmd.exe with explicit argument escaping, so values taken from
 * squad.config.json (model, effort) can never inject shell commands. Mirrors tool/lib/proc.js; the plugin is
 * deployed on its own, so it keeps its own copy instead of importing from tool/.
 */

const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';
const META_CHARS = /([()\][%!^"`<>&|;, *?])/g;
const cache = new Map();

function escapeArgument(arg, doubleEscape) {
  let out = `${arg}`;
  out = out.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  out = out.replace(/(?=(\\+?)?)\1$/, '$1$1');
  out = `"${out}"`;
  out = out.replace(META_CHARS, '^$1');
  if (doubleEscape) out = out.replace(META_CHARS, '^$1');
  return out;
}

/** Find the real executable for a bare command name on Windows (prefers .exe over .cmd over extensionless shims). */
function resolveWindowsBin(name) {
  const key = `${name}\0${process.env.PATH}`;
  if (cache.has(key)) return cache.get(key);
  let found = name;
  try {
    const lines = execFileSync('where', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
      .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && fs.existsSync(l));
    // First runnable match in PATH order; extensionless entries are POSIX-style shims cmd.exe cannot run.
    found = lines.find((l) => /\.(exe|cmd|bat)$/i.test(l)) || name;
  } catch (_) { /* fall through with the bare name */ }
  cache.set(key, found);
  return found;
}

function buildSpawn(bin, args) {
  const list = args.map(String);
  if (!IS_WIN) return { file: bin, args: list, options: {} };
  const resolved = path.isAbsolute(bin) || /[\\/]/.test(bin) ? bin : resolveWindowsBin(bin);
  if (/\.(cmd|bat)$/i.test(resolved)) {
    const command = [path.normalize(resolved).replace(META_CHARS, '^$1')].concat(list.map((a) => escapeArgument(a, true))).join(' ');
    return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${command}"`], options: { windowsVerbatimArguments: true } };
  }
  return { file: resolved, args: list, options: {} };
}

function spawnSafe(bin, args, options = {}) {
  const built = buildSpawn(bin, args);
  return spawn(built.file, built.args, { windowsHide: true, ...built.options, ...options });
}

module.exports = { spawnSafe, buildSpawn, escapeArgument };
