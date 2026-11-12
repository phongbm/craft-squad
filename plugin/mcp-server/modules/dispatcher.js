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
const { spawnSafe } = require('../shared/safe-spawn');
const { selectedClaudeAccount } = require('./claude-account');
const { createLogger } = require('../shared/logger');
const { compileRolePrompt, listArtifactTypes, ROLE_SOURCES } = require('./prompt-compiler');

const logger = createLogger('craft-squad-dispatcher', 'dispatcher.log');
const rootDir = path.resolve(__dirname, '../..');
const VALID_EFFORTS = ['low', 'medium', 'high', 'xhigh'];

function normalizeRole(name) {
  let normalized = String(name || '').toLowerCase().replace(/[\s-]/g, '_');
  if (normalized.startsWith('cs_')) {
    normalized = normalized.slice(3);
  }
  return normalized;
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
  return spawnSafe(binName, args, options);
}

function killProcessTree(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (_) {
          child.kill('SIGKILL');
        }
    }
  } catch (e) {
    // already gone
  }
}

/** Appends text to .craft-squad/logs/<fileName> under cwd. Never throws. */
function appendDispatchLog(cwd, fileNames, text) {
  try {
    const logDir = path.join(cwd, '.craft-squad', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    for (const name of [].concat(fileNames)) {
      fs.appendFileSync(path.join(logDir, name), text, 'utf8');
    }
  } catch (e) {
    logger.warn(`Failed to write dispatch log: ${e.message}`);
  }
}

/** Runs a CLI engine, feeding the prompt through stdin (no argv length / quoting limits). */
function runEngineProcess({ bin, args, input, cwd, timeoutSeconds, label, metadata, env }) {
  const logFiles = ['latest-dispatch.log', `dispatch-${(metadata && (metadata.role || metadata.engine)) || 'engine'}.log`];
  const logLine = (text) => appendDispatchLog(cwd, logFiles, text);
  logLine(`\n===== [${new Date().toISOString()}] ${label} dispatch start (model=${(metadata && metadata.model) || '-'}, effort=${(metadata && metadata.effort) || '-'}) =====\n`);

  return new Promise((resolve) => {
    let timer;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      logLine(`\n===== [${new Date().toISOString()}] ${label} dispatch end (success=${result.success}, exitCode=${result.exitCode}) =====\n`);
      resolve({ ...result, metadata });
    };

    let child;
    try {
      child = spawnCli(bin, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    } catch (e) {
      const msg = `Failed to start ${label}: ${e.message}`;
      logLine(`${msg}\n`);
      return finish({ success: false, exitCode: null, output: msg });
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutSeconds * 1000);

    if (child.stdout) child.stdout.setEncoding('utf8');
    if (child.stderr) child.stderr.setEncoding('utf8');
    child.stdout.on('data', (s) => { stdout += s; logLine(s); });
    child.stderr.on('data', (s) => { stderr += s; logLine(s); });
    child.stdin.on('error', () => { /* process may exit before reading stdin */ });

    child.on('error', (err) => {
      const msg = `Failed to run ${label}: ${err.message}`;
      logLine(`${msg}\n`);
      finish({ success: false, exitCode: null, output: msg });
    });

    child.on('close', (code) => {
      if (timedOut) {
        const msg = `${label} timed out after ${timeoutSeconds}s (15-minute limit).`;
        logLine(`\n${msg}\n`);
        return finish({
          success: false,
          exitCode: code || 124,
          output: `${msg}\n${stdout}`.trim()
        });
      }
      let combined = stdout.trim();
      if (stderr.trim()) {
        combined = combined ? `${combined}\n${stderr.trim()}` : stderr.trim();
      }
      finish({ success: code === 0, exitCode: code, output: combined });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

function executeCodex({ prompt, role, model, effort, cwd, timeoutSeconds }) {
  logger.info(`[Codex Dispatch] model=${model || '(cli default)'} effort=${effort} cwd=${cwd}`);
  const args = ['exec'];
  if (model) args.push('-m', model);
  args.push('-c', `model_reasoning_effort="${effort}"`, '-s', 'workspace-write', '--dangerously-bypass-approvals-and-sandbox', '-C', cwd);
  return runEngineProcess({
    bin: 'codex', args, input: prompt, cwd, timeoutSeconds, label: 'Codex CLI',
    metadata: { engine: 'codex', role, model, effort, cwd }
  });
}

function executeClaude({ prompt, role, model, effort, cwd, timeoutSeconds }) {
  logger.info(`[Claude Dispatch] model=${model || '(cli default)'} effort=${effort} cwd=${cwd}`);
  const args = ['-p', '--dangerously-skip-permissions'];
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  const account = selectedClaudeAccount();
  return runEngineProcess({
    bin: 'claude', args, input: prompt, cwd, timeoutSeconds, label: 'Claude Code CLI',
    env: account ? { ...process.env, CLAUDE_CONFIG_DIR: account.dir } : undefined,
    metadata: { engine: 'claude', role, model, effort, cwd, claudeAccount: account ? account.id : 'system' }
  });
}

function executeCliCommand({ command, cwd, timeoutSeconds, role }) {
  logger.info(`[CLI Dispatch] command=${command} cwd=${cwd}`);
  const roleKey = role || 'cli';
  const logFiles = ['latest-dispatch.log', 'dispatch-' + roleKey + '.log'];
  const logLine = (text) => appendDispatchLog(cwd, logFiles, text);
  logLine(`
===== [${new Date().toISOString()}] CLI command dispatch start (role=${roleKey}, command=${command || '-'}) =====
`);
  const metadata = { engine: 'cli', command, cwd };

  return new Promise((resolve) => {
    let timer;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      logLine(`
===== [${new Date().toISOString()}] CLI command dispatch end (success=${result.success}, exitCode=${result.exitCode}) =====
`);
      resolve({ ...result, metadata });
    };

    if (!command) {
      const msg = 'No command configured for this role in squad.config.json.';
      logLine(`${msg}
`);
      return finish({ success: false, exitCode: null, output: msg });
    }

    let child;
    try {
      child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    } catch (err) {
      logLine(`${err.message}
`);
      return finish({ success: false, exitCode: 1, output: err.message });
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    timer = setTimeout(() => { timedOut = true; killProcessTree(child); }, timeoutSeconds * 1000);

    if (child.stdout) child.stdout.setEncoding('utf8');
    if (child.stderr) child.stderr.setEncoding('utf8');
    child.stdout.on('data', (s) => { stdout += s; logLine(s); });
    child.stderr.on('data', (s) => { stderr += s; logLine(s); });

    child.on('error', (err) => {
      logLine(`${err.message}
`);
      finish({ success: false, exitCode: 1, output: [stdout.trim(), err.message].filter(Boolean).join('\n') });
    });

    child.on('close', (code) => {
      const out = [stdout, stderr].map((x) => x.trim()).filter(Boolean).join('\n');
      if (timedOut) {
        const msg = `CLI command timed out after ${timeoutSeconds}s.`;
        logLine(`
${msg}
`);
        return finish({ success: false, exitCode: code || 124, output: [out, msg].filter(Boolean).join('\n') });
      }
      finish({ success: code === 0, exitCode: typeof code === 'number' ? code : 1, output: out });
    });
  });
}

/* --------------------------------- dispatch --------------------------------- */

/**
 * @param {string} roleName
 * @param {string} prompt          the task for the role
 * @param {object} options         { workingDirectory, reasoningEffort, modelOverride, timeoutSeconds, artifactType, dryRun, promptFile, storyPath }
 *                                 promptFile: read the task prompt from this file; storyPath: read a Story markdown and wrap it as the task.
 */
async function dispatchRole(roleName, prompt, options = {}) {
  const cwd = options.workingDirectory || process.cwd();
  const resolveFrom = (p) => (path.isAbsolute(p) ? p : path.resolve(cwd, p));
  const sourceCount = [options.promptFile, options.storyPath, options.epicPath].filter((x) => x !== undefined).length;
  if (sourceCount > 1) {
    throw new Error('Cannot specify more than one of promptFile, storyPath, or epicPath.');
  }
  if (options.promptFile !== undefined && !String(options.promptFile).trim()) {
    throw new Error('Invalid empty promptFile provided.');
  }
  if (options.storyPath !== undefined && !String(options.storyPath).trim()) {
    throw new Error('Invalid empty storyPath provided.');
  }
  if (options.epicPath !== undefined && !String(options.epicPath).trim()) {
    throw new Error('Invalid empty epicPath provided.');
  }
  if (options.promptFile) {
    prompt = fs.readFileSync(resolveFrom(options.promptFile), 'utf8');
  } else if (options.storyPath) {
    const rawStory = fs.readFileSync(resolveFrom(options.storyPath), 'utf8');
    if (!rawStory.trim()) throw new Error('Story file is empty or contains only whitespace.');
    prompt = 'Implement/Execute the following Story according to role charter:\n\n' + rawStory;
  } else if (options.epicPath) {
    const rawEpic = fs.readFileSync(resolveFrom(options.epicPath), 'utf8');
    if (!rawEpic.trim()) throw new Error('Epic file is empty or contains only whitespace.');
    prompt = 'Implement/Execute the following Epic and all its contained Stories in a single batch according to role charter:\n\n' + rawEpic;
  }
  prompt = String(prompt || '');
  const { config, filePath } = resolveConfig(cwd);

  const roleKey = normalizeRole(roleName);
  const roleConfig = config.roles ? config.roles[roleKey] : null;
  if (!roleConfig) {
    throw new Error(`Role "${roleName}" is not defined in squad.config.json. Available roles: [${Object.keys(config.roles || {}).join(', ')}]`);
  }

  const engine = (roleConfig.engine || '').toLowerCase();
  if (!engine) throw new Error(`Role "${roleKey}" has no engine in ${filePath}`);

  // The cli engine runs a configured command and never consumes a prompt.
  if (engine !== 'cli' && !prompt.trim()) {
    throw new Error(`A non-empty prompt, promptFile, storyPath, or epicPath is required to dispatch role "${roleName}".`);
  }

  const model = options.modelOverride || roleConfig.model;
  const effort = detectReasoningEffort(
    prompt, options.reasoningEffort, roleConfig,
    config.defaultReasoningEffort, config.geminiDefaultReasoningEffort
  );
  const timeoutSeconds = Number(options.timeoutSeconds || roleConfig.timeoutSeconds || config.timeoutSeconds || 900);

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
    return { ...base, ...(await executeCliCommand({ command: roleConfig.command, cwd, timeoutSeconds, role: roleKey })) };
  }

  const compiled = compileRolePrompt(roleKey, stripEffortTags(prompt), { artifactType: options.artifactType });
  const compileInfo = { artifactType: compiled.artifactType, sources: compiled.sources, missingSources: compiled.missing };

  if (options.dryRun) {
    const dry = { ...base, success: true, dryRun: true, ...compileInfo, compiledPrompt: compiled.prompt, output: '' };
    if (engine === 'claude') { const account = selectedClaudeAccount(); dry.claudeAccount = account ? account.id : 'system'; dry.claudeConfigDir = account ? account.dir : null; }
    return dry;
  }

  let result;
  switch (engine) {
    case 'codex':
      result = await executeCodex({ prompt: compiled.prompt, role: roleKey, model, effort, cwd, timeoutSeconds });
      break;
    case 'claude':
      result = await executeClaude({ prompt: compiled.prompt, role: roleKey, model, effort, cwd, timeoutSeconds });
      break;
    case 'gemini':
    case 'antigravity':
      result = {
        success: true,
        exitCode: 0,
        output:
          `[CraftSquad Subagent Delegation Notice: ${base.title} (${roleKey})]\n` +
          `Engine: Gemini | Model: ${model || 'gemini-3.8-flash'} | Reasoning effort: ${effort}\n` +
          `MANDATORY ACTION: The Host Agent MUST NOT execute this role directly in the parent conversation.\n` +
          `Launch this role as an independent subagent using:\n` +
          `  invoke_subagent(TypeName="cs-${roleKey.replace(/_/g, '-')}", Role="${base.title}", Prompt=<compiled_prompt_below>)\n\n` +
          `--- COMPILED ROLE PROMPT ---\n` +
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
          prompt: { type: 'string', description: 'The task, with the context the role needs. Optional tag [effort: low|medium|high|xhigh] overrides reasoning effort. Ignored when promptFile, storyPath, or epicPath is given.' },
          promptFile: { type: 'string', description: 'Optional path to a file containing the task prompt.' },
          storyPath: { type: 'string', description: 'Optional path to a Story markdown file to execute.' },
          epicPath: { type: 'string', description: 'Optional path to an Epic markdown file to execute all its stories in batch.' },
          artifactType: { type: 'string', description: `Optional output template to apply. ${artifacts}` },
          reasoningEffort: { type: 'string', enum: VALID_EFFORTS, description: 'Optional effort override.' },
          modelOverride: { type: 'string', description: 'Optional one-off model override.' },
          workingDirectory: { type: 'string', description: 'Project root directory.' },
          timeoutSeconds: { type: 'integer', description: 'Execution timeout (default from config, else 900).' },
          dryRun: { type: 'boolean', description: 'Resolve routing and compile the prompt without running any engine.' }
        },
        required: ['role']
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
  appendDispatchLog,
  executeCliCommand,
  resolveConfig,
  detectReasoningEffort,
  setRole,
  getDispatcherTools,
  handleDispatcherToolCall
};
