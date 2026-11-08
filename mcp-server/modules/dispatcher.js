/**
 * CraftSquad - Engine Dispatcher
 *
 * Routes a squad role to its configured engine at call time:
 *   - codex   : OpenAI Codex CLI (prompt piped through stdin)
 *   - claude  : Claude Code CLI  (prompt piped through stdin)
 *   - gemini  : Antigravity itself; returns the compiled role prompt for the host agent to execute
 *   - cli     : deterministic terminal command from config (exit code is the verdict)
 *
 * Nothing about models, engines or effort is hardcoded here: everything comes from squad.config.json,
 * which is re-read on every call so changes apply immediately.
 *
 * Reasoning effort precedence:
 *   1. [effort: low|medium|high|xhigh] tag inside the prompt
 *   2. explicit reasoningEffort argument
 *   3. roles.<role>.defaultReasoningEffort
 *   4. geminiDefaultReasoningEffort when the role runs on Gemini
 *   5. defaultReasoningEffort
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { createLogger } = require('../shared/logger');
const { compileRolePrompt, listArtifactTypes, ROLE_SOURCES } = require('./prompt-compiler');

const logger = createLogger('craft-squad-dispatcher', 'dispatcher.log');
const rootDir = path.resolve(__dirname, '../..');
const VALID_EFFORTS = ['low', 'medium', 'high', 'xhigh'];

function normalizeRole(name) {
  return String(name || '').toLowerCase().replace(/[\s-]/g, '_');
}

/**
 * Resolve squad.config.json. Priority: <project>/squad.config.json, <project>/.agents/squad.config.json, package default.
 */
function resolveConfig(projectDir = process.cwd()) {
  const candidates = [
    path.join(projectDir, 'squad.config.json'),
    path.join(projectDir, '.agents', 'squad.config.json'),
    path.join(rootDir, 'squad.config.json')
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return { config: JSON.parse(fs.readFileSync(candidate, 'utf8')), filePath: candidate };
    } catch (e) {
      logger.warn(`Failed to parse config at ${candidate}: ${e.message}`);
    }
  }
  throw new Error(`No valid squad.config.json found (looked in: ${candidates.join(', ')})`);
}

function detectReasoningEffort(prompt = '', explicitEffort, roleConfig = {}, globalDefault = 'medium', geminiDefault = 'high') {
  const patterns = [
    /\[(?:reasoning|effort)\s*[:=]\s*(low|medium|high|xhigh)\]/i,
    /(?:reasoning_effort|reasoning|effort)\s*[:=]\s*(low|medium|high|xhigh)/i
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) return match[1].toLowerCase();
  }

  if (explicitEffort && VALID_EFFORTS.includes(String(explicitEffort).toLowerCase())) {
    return String(explicitEffort).toLowerCase();
  }

  const roleDefault = roleConfig.defaultReasoningEffort;
  if (roleDefault && VALID_EFFORTS.includes(String(roleDefault).toLowerCase())) {
    return String(roleDefault).toLowerCase();
  }

  const engine = (roleConfig.engine || '').toLowerCase();
  const model = (roleConfig.model || '').toLowerCase();
  if (engine === 'gemini' || model.includes('gemini')) {
    return geminiDefault || 'high';
  }
  return globalDefault || 'medium';
}

function stripEffortTags(prompt) {
  return prompt.replace(/\[(?:reasoning|effort)\s*[:=]\s*(?:low|medium|high|xhigh)\]/gi, '').trim();
}

/* ------------------------------ process helpers ------------------------------ */

function spawnCli(binName, args, options = {}) {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/c', binName, ...args], { ...options, windowsHide: true });
  }
  return spawn(binName, args, options);
}

function killProcessTree(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      child.kill('SIGKILL');
    }
  } catch (e) {
    // already gone
  }
}

/** Runs a CLI engine, feeding the prompt through stdin (no argv length / quoting limits). */
function runEngineProcess({ bin, args, input, cwd, timeoutSeconds, label, metadata }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnCli(bin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ success: false, exitCode: null, output: `Failed to start ${label}: ${e.message}`, metadata });
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, metadata });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutSeconds * 1000);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.stdin.on('error', () => { /* process may exit before reading stdin */ });

    child.on('error', (err) => {
      finish({ success: false, exitCode: null, output: `Failed to run ${label}: ${err.message}` });
    });

    child.on('close', (code) => {
      if (timedOut) {
        return finish({ success: false, exitCode: code, output: `${label} timed out after ${timeoutSeconds}s.\n${stdout}`.trim() });
      }
      finish({ success: code === 0, exitCode: code, output: stdout.trim() || stderr.trim() });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

function executeCodex({ prompt, model, effort, cwd, timeoutSeconds }) {
  logger.info(`[Codex Dispatch] model=${model || '(cli default)'} effort=${effort} cwd=${cwd}`);
  const args = ['exec'];
  if (model) args.push('-m', model);
  args.push('-c', `model_reasoning_effort="${effort}"`, '-s', 'workspace-write', '--dangerously-bypass-approvals-and-sandbox', '-C', cwd);
  return runEngineProcess({
    bin: 'codex', args, input: prompt, cwd, timeoutSeconds, label: 'Codex CLI',
    metadata: { engine: 'codex', model, effort, cwd }
  });
}

function executeClaude({ prompt, model, cwd, timeoutSeconds }) {
  logger.info(`[Claude Dispatch] model=${model || '(cli default)'} cwd=${cwd}`);
  const args = ['-p', '--dangerously-skip-permissions'];
  if (model) args.push('--model', model);
  return runEngineProcess({
    bin: 'claude', args, input: prompt, cwd, timeoutSeconds, label: 'Claude Code CLI',
    metadata: { engine: 'claude', model, cwd }
  });
}

function executeCliCommand({ command, cwd, timeoutSeconds }) {
  logger.info(`[CLI Dispatch] command=${command} cwd=${cwd}`);
  if (!command) {
    return { success: false, exitCode: null, output: 'No command configured for this role in squad.config.json.', metadata: { engine: 'cli', cwd } };
  }
  try {
    const output = execSync(command, { cwd, encoding: 'utf8', timeout: timeoutSeconds * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
    return { success: true, exitCode: 0, output: output.trim(), metadata: { engine: 'cli', command, cwd } };
  } catch (err) {
    return {
      success: false,
      exitCode: typeof err.status === 'number' ? err.status : 1,
      output: `${err.stdout || ''}\n${err.stderr || err.message}`.trim(),
      metadata: { engine: 'cli', command, cwd }
    };
  }
}

/* --------------------------------- dispatch --------------------------------- */

/**
 * @param {string} roleName
 * @param {string} prompt          the task for the role
 * @param {object} options         { workingDirectory, reasoningEffort, modelOverride, timeoutSeconds, artifactType, dryRun }
 */
async function dispatchRole(roleName, prompt, options = {}) {
  const cwd = options.workingDirectory || process.cwd();
  const { config, filePath } = resolveConfig(cwd);

  const roleKey = normalizeRole(roleName);
  const roleConfig = config.roles ? config.roles[roleKey] : null;
  if (!roleConfig) {
    throw new Error(`Role "${roleName}" is not defined in squad.config.json. Available roles: [${Object.keys(config.roles || {}).join(', ')}]`);
  }

  const engine = (roleConfig.engine || '').toLowerCase();
  if (!engine) throw new Error(`Role "${roleKey}" has no engine in ${filePath}`);

  const model = options.modelOverride || roleConfig.model;
  const effort = detectReasoningEffort(
    prompt, options.reasoningEffort, roleConfig,
    config.defaultReasoningEffort, config.geminiDefaultReasoningEffort
  );
  const timeoutSeconds = options.timeoutSeconds || roleConfig.timeoutSeconds || config.timeoutSeconds || 360;

  logger.info(`[Dispatch] role=${roleKey} engine=${engine} model=${model || '-'} effort=${effort} dryRun=${!!options.dryRun}`);

  const base = {
    role: roleKey,
    title: roleConfig.title || roleConfig.persona || roleKey,
    engine,
    model,
    reasoningEffort: effort,
    configSource: filePath
  };

  // Deterministic gate: no prompt compilation.
  if (engine === 'cli') {
    if (options.dryRun) return { ...base, success: true, dryRun: true, command: roleConfig.command, output: '' };
    return { ...base, ...executeCliCommand({ command: roleConfig.command, cwd, timeoutSeconds }) };
  }

  const compiled = compileRolePrompt(roleKey, stripEffortTags(prompt), { artifactType: options.artifactType });
  const compileInfo = { artifactType: compiled.artifactType, sources: compiled.sources, missingSources: compiled.missing };

  if (options.dryRun) {
    return { ...base, success: true, dryRun: true, ...compileInfo, compiledPrompt: compiled.prompt, output: '' };
  }

  let result;
  switch (engine) {
    case 'codex':
      result = await executeCodex({ prompt: compiled.prompt, model, effort, cwd, timeoutSeconds });
      break;
    case 'claude':
      result = await executeClaude({ prompt: compiled.prompt, model, cwd, timeoutSeconds });
      break;
    case 'gemini':
    case 'antigravity':
      result = {
        success: true,
        exitCode: 0,
        output:
          `[CraftSquad: execute this role yourself]\n` +
          `Role: ${base.title} (${roleKey}) | Reasoning effort: ${effort}\n` +
          `Adopt the role below and complete the task. Do not call squad_dispatch again for this role.\n\n` +
          compiled.prompt,
        metadata: { engine: 'gemini', model, effort, cwd }
      };
      break;
    default:
      throw new Error(`Unsupported engine "${engine}" for role "${roleKey}". Supported: codex, claude, gemini, cli`);
  }

  return { ...base, ...compileInfo, ...result };
}

/* ---------------------------------- MCP tools --------------------------------- */

function getDispatcherTools() {
  let roles = [];
  try { roles = Object.keys(resolveConfig(rootDir).config.roles || {}); } catch (e) { roles = Object.keys(ROLE_SOURCES); }
  const artifacts = Object.entries(ROLE_SOURCES)
    .filter(([, d]) => Object.keys(d.artifacts).length)
    .map(([r]) => `${r}: ${listArtifactTypes(r).join('|')}`)
    .join('; ');

  return [
    {
      name: 'squad_dispatch',
      description:
        `Dispatch a task to a squad role. The engine, model and reasoning effort come from squad.config.json at call time. ` +
        `Roles: ${roles.join(', ')}. For gemini-engine roles the compiled role prompt is returned for the host agent to execute; ` +
        `for codex/claude roles the task is executed and its output returned; qa_gatekeeper runs its configured command.`,
      inputSchema: {
        type: 'object',
        properties: {
          role: { type: 'string', description: `Squad role id. One of: ${roles.join(', ')}.` },
          prompt: { type: 'string', description: 'The task, with the context the role needs. Optional tag [effort: low|medium|high|xhigh] overrides reasoning effort.' },
          artifactType: { type: 'string', description: `Optional upstream template to apply. ${artifacts}` },
          reasoningEffort: { type: 'string', enum: VALID_EFFORTS, description: 'Optional effort override.' },
          modelOverride: { type: 'string', description: 'Optional one-off model override.' },
          workingDirectory: { type: 'string', description: 'Project root directory.' },
          timeoutSeconds: { type: 'integer', description: 'Execution timeout (default from config, else 360).' },
          dryRun: { type: 'boolean', description: 'Resolve routing and compile the prompt without running any engine.' }
        },
        required: ['role', 'prompt']
      }
    },
    {
      name: 'squad_get_config',
      description: 'Return the active squad role configuration (role -> engine, model, effort).',
      inputSchema: {
        type: 'object',
        properties: { workingDirectory: { type: 'string', description: 'Project directory used to resolve squad.config.json.' } }
      }
    },
    {
      name: 'squad_set_role',
      description: 'Change the engine, model and/or default reasoning effort of a role in the project squad.config.json.',
      inputSchema: {
        type: 'object',
        properties: {
          role: { type: 'string', description: 'Role id to update.' },
          engine: { type: 'string', enum: ['codex', 'claude', 'gemini', 'cli'], description: 'Target engine.' },
          model: { type: 'string', description: 'Model id. If omitted, engineDefaults.<engine> from config is used.' },
          reasoningEffort: { type: 'string', enum: VALID_EFFORTS, description: 'Role default reasoning effort.' },
          workingDirectory: { type: 'string', description: 'Project directory containing squad.config.json.' }
        },
        required: ['role', 'engine']
      }
    }
  ];
}

function setRole({ role, engine, model, reasoningEffort, workingDirectory }) {
  const cwd = workingDirectory || process.cwd();
  const targetFile = path.join(cwd, 'squad.config.json');
  const currentConfig = resolveConfig(cwd).config;
  const roleKey = normalizeRole(role);
  if (!currentConfig.roles) currentConfig.roles = {};

  const engineKey = String(engine).toLowerCase();
  const resolvedModel = model || (currentConfig.engineDefaults || {})[engineKey];
  const next = { ...(currentConfig.roles[roleKey] || {}), engine: engineKey };
  if (resolvedModel) next.model = resolvedModel; else delete next.model;
  if (reasoningEffort) next.defaultReasoningEffort = reasoningEffort;
  currentConfig.roles[roleKey] = next;

  fs.writeFileSync(targetFile, JSON.stringify(currentConfig, null, 2) + '\n', 'utf8');
  logger.info(`Updated role "${roleKey}" in ${targetFile}`);
  return { success: true, configPath: targetFile, role: roleKey, settings: next };
}

async function handleDispatcherToolCall(name, args = {}) {
  const cwd = args.workingDirectory || process.cwd();

  if (name === 'squad_get_config') {
    const { config, filePath } = resolveConfig(cwd);
    return { configSource: filePath, config };
  }
  if (name === 'squad_set_role') return setRole(args);
  if (name === 'squad_dispatch') {
    const r = await dispatchRole(args.role, args.prompt, args);
    const header =
      `[squad_dispatch] role=${r.role} engine=${r.engine} model=${r.model || '-'} effort=${r.reasoningEffort} ` +
      `success=${r.success}${r.exitCode !== undefined && r.exitCode !== null ? ` exitCode=${r.exitCode}` : ''}` +
      `${r.dryRun ? ' dryRun=true' : ''}`;
    const body = r.dryRun && r.compiledPrompt ? r.compiledPrompt : (r.output || '');
    return { content: [{ type: 'text', text: `${header}\n\n${body}`.trim() }], isError: r.success === false };
  }
  throw new Error(`Unknown dispatcher tool: ${name}`);
}

module.exports = {
  dispatchRole,
  resolveConfig,
  detectReasoningEffort,
  setRole,
  getDispatcherTools,
  handleDispatcherToolCall
};
