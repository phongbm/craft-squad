/**
 * CraftSquad Tool - Squad Config Manager
 * Reads and updates squad.config.json (role -> engine/model/effort). The server resolves the file itself;
 * callers never choose a directory.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { ApiError } = require('./errors');

const rootDir = path.resolve(__dirname, '../..');
const pluginDir = path.join(rootDir, 'plugin');

const ENGINES = ['claude', 'codex', 'gemini', 'cli'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh'];

// Aliases that Claude Code and common gate commands accept; every other model comes from the user's own config.
const STATIC_PRESETS = {
  claude: ['sonnet', 'opus', 'haiku'],
  cli: ['npm test', 'npm run lint', 'npm run build']
};

function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  let mode = 0o644;
  try { mode = fs.statSync(filePath).mode & 0o777; } catch (_) {}
  try {
    const fd = fs.openSync(tmpPath, 'wx', mode);
    try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n', 'utf8'); } finally { fs.closeSync(fd); }
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    fs.rmSync(tmpPath, { force: true });
    throw err;
  }
}

function resolveConfigFile() {
  const candidates = [
    path.join(process.cwd(), 'squad.config.json'),
    path.join(process.cwd(), '.agents', 'squad.config.json')
  ];
  if (path.resolve(process.cwd()) !== path.resolve(rootDir)) {
    candidates.push(path.join(os.homedir(), '.gemini', 'config', 'plugins', 'craft-squad', 'squad.config.json'));
  }
  candidates.push(path.join(pluginDir, 'squad.config.json'), path.join(rootDir, 'squad.config.json'));
  return candidates.find((c) => fs.existsSync(c)) || path.join(pluginDir, 'squad.config.json');
}

function loadConfig() {
  const file = resolveConfigFile();
  try {
    return { file, config: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    throw new ApiError(500, `Could not read ${file}: ${err.message}`);
  }
}

/** Model choices per engine: built-in aliases plus every model already used in the config. */
function buildPresets(config) {
  const presets = {};
  for (const engine of ENGINES) {
    const seen = new Set(STATIC_PRESETS[engine] || []);
    const fromDefaults = config.engineDefaults && config.engineDefaults[engine];
    if (fromDefaults) seen.add(fromDefaults);
    for (const role of Object.values(config.roles || {})) {
      if (role.engine === engine) {
        const value = engine === 'cli' ? role.command : role.model;
        if (value) seen.add(value);
      }
    }
    presets[engine] = [...seen].map((id) => ({ id, label: id }));
  }
  return presets;
}

function getSquadConfig() {
  const { file, config } = loadConfig();
  return { configPath: file, config, presets: buildPresets(config), engines: ENGINES, efforts: EFFORTS };
}

function cleanText(value, label) {
  const text = String(value).trim();
  if (!text || text.length > 200 || /[\u0000-\u001f]/.test(text)) throw new ApiError(400, `Enter a valid ${label}.`);
  return text;
}

function updateRoleConfig(role, { engine, model, reasoningEffort, command } = {}) {
  const { file, config } = loadConfig();
  const roleKey = String(role || '').toLowerCase().replace(/[\s-]/g, '_').replace(/^cs_/, '');
  if (!config.roles || !config.roles[roleKey]) throw new ApiError(404, `Unknown role "${role}".`);
  if (engine && !ENGINES.includes(engine)) throw new ApiError(400, `Engine must be one of ${ENGINES.join(', ')}.`);
  if (reasoningEffort && !EFFORTS.includes(reasoningEffort)) throw new ApiError(400, `Effort must be one of ${EFFORTS.join(', ')}.`);

  const target = config.roles[roleKey];
  const nextEngine = engine || target.engine;
  if (engine) target.engine = engine;
  if (nextEngine === 'cli') {
    if (command) target.command = cleanText(command, 'command');
    delete target.model;
    delete target.defaultReasoningEffort;
  } else {
    if (model) target.model = cleanText(model, 'model');
    if (reasoningEffort) target.defaultReasoningEffort = reasoningEffort;
    delete target.command;
  }
  writeJsonAtomic(file, config);
  return { role: roleKey, updated: target, configPath: file };
}

module.exports = { ENGINES, EFFORTS, resolveConfigFile, getSquadConfig, updateRoleConfig, buildPresets };
