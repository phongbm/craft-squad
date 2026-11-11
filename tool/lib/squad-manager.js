/**
 * CraftSquad Tool - Squad Config Manager
 * Reads and updates squad.config.json for role engine & model switching.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '../..');
const pluginDir = path.join(rootDir, 'plugin');

const PRESETS = {
  claude: [
    { id: 'sonnet', label: 'Claude 3.7 Sonnet (Recommended)' },
    { id: 'opus', label: 'Claude 3 Opus (Deep Analysis)' },
    { id: 'haiku', label: 'Claude 3.5 Haiku (Fast)' },
    { id: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet (Full ID)' },
    { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' }
  ],
  codex: [
    { id: 'gpt-6.1-sol', label: 'OpenAI Codex (gpt-6.1-sol)' },
    { id: 'o3-mini', label: 'o3-mini (High Reasoning / STEM)' },
    { id: 'o1', label: 'o1 (Deep Reasoning)' },
    { id: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
    { id: 'gpt-4.1', label: 'GPT-4.1 (Fast Review)' }
  ],
  gemini: [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (High Speed & Reasoning)' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deep Context)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
  ],
  cli: [
    { id: 'npm test', label: 'npm test (Unit & Integration)' },
    { id: 'npm run lint', label: 'npm run lint (Linter Gate)' },
    { id: 'npm run build', label: 'npm run build (Build Verification)' }
  ]
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

function resolveConfigFile(customDir) {
  const candidates = [];
  if (customDir) {
    candidates.push(path.join(customDir, 'squad.config.json'));
    candidates.push(path.join(customDir, '.agents', 'squad.config.json'));
  }
  candidates.push(path.join(process.cwd(), 'squad.config.json'));
  candidates.push(path.join(process.cwd(), '.agents', 'squad.config.json'));
  if (path.resolve(process.cwd()) !== path.resolve(rootDir)) {
    candidates.push(path.join(os.homedir(), '.gemini', 'config', 'plugins', 'craft-squad', 'squad.config.json'));
  }
  candidates.push(path.join(pluginDir, 'squad.config.json'));
  candidates.push(path.join(rootDir, 'squad.config.json'));

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return path.join(pluginDir, 'squad.config.json');
}

function getSquadConfig(targetDir) {
  const filePath = resolveConfigFile(targetDir);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(raw);
    return {
      success: true,
      configPath: filePath,
      config,
      presets: PRESETS
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to load squad.config.json from ${filePath}: ${err.message}`
    };
  }
}

function updateRoleConfig(role, { engine, model, reasoningEffort, command }, targetDir) {
  const filePath = resolveConfigFile(targetDir);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(raw);
    if (!config.roles) config.roles = {};

    const roleKey = String(role || '').toLowerCase().replace(/[\s-]/g, '_').replace(/^cs_/, '');
    if (!config.roles[roleKey]) {
      config.roles[roleKey] = { title: roleKey };
    }

    if (engine) config.roles[roleKey].engine = engine;
    if (engine === 'cli') {
      if (command) config.roles[roleKey].command = command;
      delete config.roles[roleKey].model;
      delete config.roles[roleKey].defaultReasoningEffort;
    } else {
      if (model) config.roles[roleKey].model = model;
      if (reasoningEffort) config.roles[roleKey].defaultReasoningEffort = reasoningEffort;
      delete config.roles[roleKey].command;
    }

    writeJsonAtomic(filePath, config);
    return {
      success: true,
      configPath: filePath,
      role: roleKey,
      updated: config.roles[roleKey]
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to update role ${role}: ${err.message}`
    };
  }
}

function updateEngineDefault(engine, model, targetDir) {
  const filePath = resolveConfigFile(targetDir);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(raw);
    if (!config.engineDefaults) config.engineDefaults = {};
    config.engineDefaults[engine] = model;

    writeJsonAtomic(filePath, config);
    return { success: true, engineDefaults: config.engineDefaults };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  PRESETS,
  resolveConfigFile,
  getSquadConfig,
  updateRoleConfig,
  updateEngineDefault
};
