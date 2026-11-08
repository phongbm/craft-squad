/**
 * CraftSquad - Unified Multi-Engine Dispatcher
 * 
 * Core orchestration engine that dynamically routes role tasks to:
 * - OpenAI Codex CLI (gpt-6.1-sol, gpt-6-astra) via ChatGPT Plus session
 * - Claude Code CLI (sonnet-3.7, sonnet-5.5) via Claude Pro session
 * - Antigravity Core (Gemini 3.8 Flash)
 * - Deterministic CLI commands (test, typecheck, build)
 * 
 * Key Features:
 * 1. Configurable role-to-model matrix (squad.config.json)
 * 2. Reasoning effort:
 *    - Roles using Gemini 3.8 Flash default to "high"
 *    - Other roles (Codex, Claude) default to "medium"
 *    - Dynamic prompt override via [effort: low|medium|high|xhigh] always takes highest precedence
 * 3. Unified cross-engine execution (Codex, Claude, Gemini, CLI)
 * 4. Structured audit logging to .agents/logs/dispatcher.log
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { createLogger } = require('../shared/logger');

const logger = createLogger('craft-squad-dispatcher', 'dispatcher.log');
const rootDir = path.resolve(__dirname, '../..');

/**
 * Resolves the active squad.config.json
 * Priority: (1) projectDir/squad.config.json -> (2) projectDir/.agents/squad.config.json -> (3) package default
 */
function resolveConfig(projectDir = process.cwd()) {
  const candidates = [
    path.join(projectDir, 'squad.config.json'),
    path.join(projectDir, '.agents', 'squad.config.json'),
    path.join(rootDir, 'squad.config.json')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, 'utf8');
        return {
          config: JSON.parse(raw),
          filePath: candidate
        };
      } catch (e) {
        logger.warn(`Failed to parse config at ${candidate}: ${e.message}`);
      }
    }
  }

  // Fallback default
  return {
    config: {
      version: '2.2.0',
      defaultReasoningEffort: 'medium',
      geminiDefaultReasoningEffort: 'high',
      roles: {
        scrum_master: { engine: 'gemini', model: 'gemini-3.8-flash', defaultReasoningEffort: 'high' },
        architect: { engine: 'codex', model: 'gpt-6.1-sol', defaultReasoningEffort: 'medium' },
        ui_designer: { engine: 'codex', model: 'gpt-6-astra', defaultReasoningEffort: 'medium' },
        developer: { engine: 'claude', model: 'claude-3-7-sonnet-latest', defaultReasoningEffort: 'medium' },
        code_reviewer: { engine: 'codex', model: 'gpt-6.1-sol', defaultReasoningEffort: 'medium' },
        tester: { engine: 'gemini', model: 'gemini-3.8-flash', defaultReasoningEffort: 'high' },
        qa_gatekeeper: { engine: 'cli', command: 'npm test' }
      }
    },
    filePath: null
  };
}

/**
 * Detects reasoning effort:
 * 1. Prompt override [effort: ...] takes highest precedence.
 * 2. Explicit argument override takes second precedence.
 * 3. Role default override (e.g. roleConfig.defaultReasoningEffort).
 * 4. Gemini 3.8 Flash roles default to "high".
 * 5. Other roles default to globalDefault (default: "medium").
 */
function detectReasoningEffort(prompt = '', explicitEffort, roleConfig = {}, globalDefault = 'medium') {
  const validEfforts = ['low', 'medium', 'high', 'xhigh'];

  // 1. Check for prompt tags: [effort: high], [reasoning: low], effort: high
  const effortPatterns = [
    /\[(?:reasoning|effort)\s*[:=]\s*(low|medium|high|xhigh)\]/i,
    /(?:reasoning_effort|reasoning|effort)\s*[:=]\s*(low|medium|high|xhigh)/i
  ];

  for (const pattern of effortPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }

  // 2. Explicit argument override
  if (explicitEffort && validEfforts.includes(explicitEffort.toLowerCase())) {
    return explicitEffort.toLowerCase();
  }

  // 3. Role-level default override
  if (roleConfig.defaultReasoningEffort && validEfforts.includes(roleConfig.defaultReasoningEffort.toLowerCase())) {
    return roleConfig.defaultReasoningEffort.toLowerCase();
  }

  // 4. Gemini 3.8 Flash rule: Default is "high"
  const engine = (roleConfig.engine || '').toLowerCase();
  const model = (roleConfig.model || '').toLowerCase();
  if (engine === 'gemini' || model.includes('gemini') || model.includes('flash')) {
    return 'high';
  }

  // 5. Global default (medium)
  return globalDefault || 'medium';
}

/**
 * Spawns a CLI command safely cross-platform
 */
function spawnCli(binName, args, options = {}) {
  const isWin = process.platform === 'win32';
  if (isWin) {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/c', binName, ...args], {
      ...options,
      windowsHide: true
    });
  }
  return spawn(binName, args, options);
}

/**
 * Executes a command via OpenAI Codex CLI
 */
function executeCodex({ prompt, model = 'gpt-6.1-sol', effort = 'medium', cwd, timeoutSeconds = 360 }) {
  return new Promise((resolve) => {
    logger.info(`[Codex Dispatch] Model: ${model} | Effort: ${effort} | CWD: ${cwd}`);

    const args = [
      'exec',
      '-m', model,
      '-c', `model_reasoning_effort="${effort}"`,
      '-s', 'workspace-write',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C', cwd
    ];

    const child = spawnCli('codex', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (e) {}
    }, timeoutSeconds * 1000);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return resolve({
          success: false,
          error: `Codex execution timed out after ${timeoutSeconds}s.`,
          output: stdout
        });
      }

      const cleanOutput = stdout.trim();
      resolve({
        success: code === 0,
        exitCode: code,
        output: cleanOutput || stderr.trim(),
        metadata: { engine: 'codex', model, effort, cwd }
      });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Executes a command via Claude Code CLI
 */
function executeClaude({ prompt, model = 'claude-3-7-sonnet-latest', cwd, timeoutSeconds = 360 }) {
  return new Promise((resolve) => {
    logger.info(`[Claude Dispatch] Model: ${model} | CWD: ${cwd}`);

    const args = [
      '--model', model,
      '--dangerously-skip-permissions',
      '-p', prompt
    ];

    const child = spawnCli('claude', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (e) {}
    }, timeoutSeconds * 1000);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return resolve({
          success: false,
          error: `Claude execution timed out after ${timeoutSeconds}s.`,
          output: stdout
        });
      }

      resolve({
        success: code === 0,
        exitCode: code,
        output: stdout.trim() || stderr.trim(),
        metadata: { engine: 'claude', model, cwd }
      });
    });
  });
}

/**
 * Executes a command via Deterministic Terminal CLI
 */
function executeCliCommand({ command, cwd, timeoutSeconds = 300 }) {
  logger.info(`[CLI Dispatch] Command: ${command} | CWD: ${cwd}`);
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutSeconds * 1000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return {
      success: true,
      exitCode: 0,
      output: output.trim(),
      metadata: { engine: 'cli', command, cwd }
    };
  } catch (err) {
    return {
      success: false,
      exitCode: err.status || 1,
      output: (err.stdout || '') + '\n' + (err.stderr || err.message),
      metadata: { engine: 'cli', command, cwd }
    };
  }
}

/**
 * Main Dispatcher Entry Point
 */
async function dispatchRole(roleName, prompt, options = {}) {
  const cwd = options.workingDirectory || process.cwd();
  const { config, filePath } = resolveConfig(cwd);

  const roleKey = roleName.toLowerCase().replace(/[\s-]/g, '_');
  const roleConfig = config.roles ? config.roles[roleKey] : null;

  if (!roleConfig) {
    const available = Object.keys(config.roles || {}).join(', ');
    throw new Error(`Role "${roleName}" is not defined in squad.config.json. Available roles: [${available}]`);
  }

  const engine = (roleConfig.engine || 'gemini').toLowerCase();
  const model = options.modelOverride || roleConfig.model;
  const effort = detectReasoningEffort(prompt, options.reasoningEffort, roleConfig, config.defaultReasoningEffort || 'medium');
  const timeoutSeconds = options.timeoutSeconds || 360;

  logger.info(`🎯 [Dispatch Start] Role: ${roleKey} -> Engine: ${engine} (${model}) | Effort: ${effort}`);

  let result;
  switch (engine) {
    case 'codex':
      result = await executeCodex({ prompt, model, effort, cwd, timeoutSeconds });
      break;

    case 'claude':
      result = await executeClaude({ prompt, model, cwd, timeoutSeconds });
      break;

    case 'cli':
      result = executeCliCommand({ command: roleConfig.command || prompt, cwd, timeoutSeconds });
      break;

    case 'gemini':
    case 'antigravity':
    default:
      // When routed to Gemini/Antigravity, return instructions formatted for Antigravity's core engine
      result = {
        success: true,
        exitCode: 0,
        output: `[Antigravity/Gemini Execution Directive]\nRole: ${roleConfig.persona || roleKey}\nModel: ${model}\nReasoning Effort: ${effort}\n\nTask:\n${prompt}`,
        metadata: { engine: 'gemini', model, effort, cwd }
      };
      break;
  }

  return {
    role: roleKey,
    persona: roleConfig.persona || roleKey,
    engine,
    model,
    reasoningEffort: effort,
    configSource: filePath,
    ...result
  };
}

const DISPATCHER_TOOLS = [
  {
    name: 'squad_dispatch',
    description: 'Dispatch a software engineering task to the designated Squad Role (developer, architect, code_reviewer, ui_designer, scrum_master, tester, qa_gatekeeper). Dynamically routes to OpenAI Codex, Claude Code, Gemini, or CLI per squad.config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['developer', 'architect', 'ui_designer', 'code_reviewer', 'tester', 'scrum_master', 'qa_gatekeeper'],
          description: 'The squad role to execute the task.'
        },
        prompt: {
          type: 'string',
          description: 'Detailed prompt or specification. You can include [effort: high|medium|low|xhigh] to override reasoning effort.'
        },
        reasoningEffort: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'xhigh'],
          description: 'Optional reasoning effort override.'
        },
        modelOverride: {
          type: 'string',
          description: 'Optional model override for this turn.'
        },
        workingDirectory: {
          type: 'string',
          description: 'Target project root directory.'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Execution timeout in seconds (default: 360).'
        }
      },
      required: ['role', 'prompt']
    }
  },
  {
    name: 'squad_get_config',
    description: 'Retrieve the current active Squad role-to-engine configuration matrix.',
    inputSchema: {
      type: 'object',
      properties: {
        workingDirectory: {
          type: 'string',
          description: 'Optional directory to resolve project-specific config.'
        }
      }
    }
  },
  {
    name: 'squad_set_role',
    description: 'Update the engine and model for a specific squad role in squad.config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'The role to update (e.g. developer, code_reviewer, architect).'
        },
        engine: {
          type: 'string',
          enum: ['codex', 'claude', 'gemini', 'cli'],
          description: 'Target AI engine.'
        },
        model: {
          type: 'string',
          description: 'Model identifier (e.g. gpt-6.1-sol, claude-3-7-sonnet-latest, gemini-3.8-flash).'
        },
        workingDirectory: {
          type: 'string',
          description: 'Target directory where squad.config.json is located.'
        }
      },
      required: ['role', 'engine']
    }
  }
];

async function handleDispatcherToolCall(name, args) {
  const cwd = args.workingDirectory || process.cwd();

  if (name === 'squad_get_config') {
    const { config, filePath } = resolveConfig(cwd);
    return {
      configSource: filePath,
      config
    };
  }

  if (name === 'squad_set_role') {
    const targetFile = path.join(cwd, 'squad.config.json');
    let currentConfig = resolveConfig(cwd).config;

    if (!currentConfig.roles) currentConfig.roles = {};
    const roleKey = args.role.toLowerCase().replace(/[\s-]/g, '_');

    currentConfig.roles[roleKey] = {
      ...(currentConfig.roles[roleKey] || {}),
      engine: args.engine,
      model: args.model || (args.engine === 'codex' ? 'gpt-6.1-sol' : args.engine === 'claude' ? 'claude-3-7-sonnet-latest' : 'gemini-3.8-flash')
    };

    fs.writeFileSync(targetFile, JSON.stringify(currentConfig, null, 2), 'utf8');
    logger.info(`Updated role "${roleKey}" in ${targetFile}`);

    return {
      success: true,
      message: `Updated role "${roleKey}" -> engine: ${args.engine}, model: ${currentConfig.roles[roleKey].model}`,
      configPath: targetFile
    };
  }

  if (name === 'squad_dispatch') {
    return await dispatchRole(args.role, args.prompt, args);
  }

  throw new Error(`Unknown dispatcher tool: ${name}`);
}

module.exports = {
  dispatchRole,
  resolveConfig,
  detectReasoningEffort,
  DISPATCHER_TOOLS,
  handleDispatcherToolCall
};
