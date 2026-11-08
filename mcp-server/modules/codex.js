/**
 * CraftSquad - OpenAI Codex Module
 * Bridges Antigravity 2.0 to OpenAI Codex CLI via Model Context Protocol.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createLogger } = require('../shared/logger');

const logger = createLogger('craft-squad-codex', 'craft-squad-codex.log');

const CODEX_TOOLS = [
  {
    name: 'codex_design_ui',
    description: 'Generate cross-platform presentational UI component skeletons (Web Tailwind, Flutter, React Native) using OpenAI Codex (Codex Astra role). Respects design tokens, touch ergonomics (>= 48dp), safe areas, and mobile breakpoints without generating backend logic.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed specification describing the UI component, state variations, layout, and visual styling.'
        },
        platform: {
          type: 'string',
          enum: ['web-tailwind', 'mobile-flutter', 'mobile-react-native'],
          description: 'Target platform styling framework (default: web-tailwind).'
        },
        componentName: {
          type: 'string',
          description: 'Optional name of the primary component (e.g. UserProfileCard).'
        },
        targetFile: {
          type: 'string',
          description: 'Optional relative file path where the component will be located (e.g. src/features/profile/UserProfileCard.tsx).'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional project root directory.'
        },
        reasoningEffort: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'xhigh'],
          description: 'Reasoning effort override (default: "medium" for standard screens, "high" for complex/aesthetic UI).'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 240s for medium, 360s for high).'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'codex_architect_plan',
    description: 'Perform deep architectural design, domain modeling, and complex algorithmic planning using OpenAI Codex frontier reasoning (gpt-6.1-sol).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Architecture requirements, state machine specification, or complex engineering problem to plan.'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional project root directory.'
        },
        reasoningEffort: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'xhigh'],
          description: 'Reasoning effort override (default: "high", "xhigh" for mission-critical architecture).'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 360s for high, 600s for xhigh).'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'codex_security_audit',
    description: 'Perform deep application security (AppSec) audit, vulnerability review, OWASP compliance, Supabase/Firebase RLS verification, and data leakage checks using OpenAI Codex frontier reasoning (gpt-6.1-sol).',
    inputSchema: {
      type: 'object',
      properties: {
        codeDiffOrFiles: {
          type: 'string',
          description: 'Code diff, source code snippets, or list of files to audit for security vulnerabilities.'
        },
        focusAreas: {
          type: 'string',
          description: 'Optional focus areas, e.g. "Supabase RLS", "AuthZ/RBAC", "Input Sanitization", "Secret Leaks", "OWASP Top 10".'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional project root directory.'
        },
        reasoningEffort: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'xhigh'],
          description: 'Reasoning effort override (default: "high", "xhigh" for deep RLS / full pentest).'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 360s for high, 600s for xhigh).'
        }
      },
      required: ['codeDiffOrFiles']
    }
  },
  {
    name: 'codex_exec',
    description: 'Run general non-interactive instructions directly through OpenAI Codex CLI.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Instructions or prompt for Codex.'
        },
        sandbox: {
          type: 'string',
          enum: ['read-only', 'workspace-write', 'danger-full-access'],
          description: 'Sandbox execution policy (default: workspace-write).'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional project root directory.'
        },
        model: {
          type: 'string',
          description: 'Optional model override (e.g. gpt-6-astra, gpt-6.1-sol).'
        },
        reasoningEffort: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'xhigh'],
          description: 'Reasoning effort override (default: high).'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 360s).'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'codex_adversarial_review',
    description: 'Perform an adversarial, hyper-critical review using Codex Sentinel (gpt-6.1-sol) on code or architecture produced by Gemini or Claude to expose hidden bugs, logic flaws, and spec drift.',
    inputSchema: {
      type: 'object',
      properties: {
        codeDiffOrFiles: {
          type: 'string',
          description: 'Code diff, git commit range, or list of files to rigorously review.'
        },
        specOrAcceptanceCriteria: {
          type: 'string',
          description: 'The story specification or Acceptance Criteria to audit the code against.'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional project root directory.'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 360s).'
        }
      },
      required: ['codeDiffOrFiles']
    }
  },
  {
    name: 'codex_rescue',
    description: 'Escalate a persistently failing task, compiler error loop, or tricky bug to Codex Planner/Sentinel (gpt-6.1-sol) with fresh context when other agents are stuck.',
    inputSchema: {
      type: 'object',
      properties: {
        errorLogs: {
          type: 'string',
          description: 'Detailed error messages, stack traces, compiler output, or test failures.'
        },
        contextDescription: {
          type: 'string',
          description: 'Summary of what the task was attempting to achieve and previous failed attempts.'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional project root directory.'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 360s).'
        }
      },
      required: ['errorLogs', 'contextDescription']
    }
  }
];

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  const pid = proc.pid;
  logger.warn(`Terminating process tree for PID ${pid}...`);

  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      logger.info(`Process tree PID ${pid} killed via taskkill.`);
    } catch (e) {
      try { proc.kill('SIGKILL'); } catch (e2) {}
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch (e) {
      try { proc.kill('SIGKILL'); } catch (e2) {}
    }
  }
}

function resolveReasoningEffort(role, userEffort, contextText = '') {
  if (userEffort && ['low', 'medium', 'high', 'xhigh'].includes(userEffort)) {
    return userEffort;
  }

  const text = (contextText || '').toLowerCase();

  if (role === 'astra') {
    const isComplex = text.includes('complex') || text.includes('dashboard') || text.includes('workbench') ||
      text.includes('canvas') || text.includes('drag') || text.includes('animation') ||
      text.includes('design system') || text.includes('checkout') || text.includes('multi-step') ||
      text.includes('tỉ mỉ') || text.includes('nâng cao') || text.includes('phức tạp') || text.includes('chuyên sâu');
    return isComplex ? 'high' : 'medium';
  }

  if (role === 'planner') {
    const isXHigh = text.includes('state machine') || text.includes('distributed') ||
      text.includes('campaign pack') || text.includes('campaign-centric') ||
      text.includes('orchestration engine') || text.includes('concurrency') ||
      text.includes('distributed transaction') || text.includes('chuyên sâu') ||
      text.includes('quy mô lớn') || text.includes('xhigh');
    return isXHigh ? 'xhigh' : 'high';
  }

  if (role === 'sentinel') {
    const isXHigh = text.includes('rls') || text.includes('multi-tenant') ||
      text.includes('row level security') || text.includes('payment') ||
      text.includes('financial') || text.includes('crypto') || text.includes('audit toàn diện');
    return isXHigh ? 'xhigh' : 'high';
  }

  return 'high';
}

function resolveTimeoutMs(effort, userTimeoutSeconds) {
  if (userTimeoutSeconds && Number(userTimeoutSeconds) > 0) {
    return Number(userTimeoutSeconds) * 1000;
  }

  switch (effort) {
    case 'xhigh':
      return 600000;
    case 'high':
      return 360000;
    case 'medium':
      return 240000;
    case 'low':
    default:
      return 180000;
  }
}

function runCodexCli({ prompt, sandbox = 'workspace-write', workingDirectory, model, reasoningEffort = 'high', timeoutMs = 300000 }) {
  return new Promise((resolve, reject) => {
    let cwd = workingDirectory ? path.resolve(workingDirectory) : process.cwd();
    if (!fs.existsSync(cwd)) {
      logger.warn(`Provided workingDirectory does not exist: "${workingDirectory}". Falling back to: "${process.cwd()}"`);
      cwd = process.cwd();
    }

    const tmpFile = path.join(os.tmpdir(), `codex_out_${Date.now()}_${Math.random().toString(36).substring(7)}.md`);
    const args = ['exec', '--skip-git-repo-check', '-s', sandbox, '--ephemeral', '-o', tmpFile];
    if (cwd) args.push('-C', cwd);
    if (model) args.push('-m', model);
    if (reasoningEffort) args.push('-c', `model_reasoning_effort="${reasoningEffort}"`);
    args.push('-');

    const startTime = Date.now();
    logger.info(`Starting Codex CLI execution`, {
      projectCwd: cwd,
      model: model || 'default',
      sandbox,
      reasoningEffort,
      timeoutMs,
      promptSnippet: prompt.length > 200 ? prompt.substring(0, 200) + '...' : prompt
    });

    let proc;
    if (process.platform === 'win32') {
      proc = spawn('cmd.exe', ['/c', 'codex', ...args], {
        cwd,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } else {
      proc = spawn('codex', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => { stdout += data.toString(); });
    proc.stderr.on('data', data => { stderr += data.toString(); });

    proc.stdin.write(prompt);
    proc.stdin.end();

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      logger.error(`Codex CLI execution timed out after ${timeoutMs / 1000}s`);
      killProcessTree(proc);
      reject(new Error(`Codex CLI execution timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return;

      const durationMs = Date.now() - startTime;
      logger.info(`Codex CLI finished with exit code ${code} (${(durationMs / 1000).toFixed(1)}s)`);

      let outputText = '';
      if (fs.existsSync(tmpFile)) {
        try {
          outputText = fs.readFileSync(tmpFile, 'utf8');
          fs.unlinkSync(tmpFile);
        } catch (e) {
          logger.warn(`Could not read/clean temp file ${tmpFile}: ${e.message}`);
        }
      }

      if (!outputText && stdout) outputText = stdout;

      if (code !== 0 && !outputText) {
        logger.error(`Codex CLI failed with exit code ${code}`, { stderr, stdout });
        reject(new Error(`Codex CLI process exited with code ${code}: ${stderr || stdout}`));
        return;
      }

      resolve(outputText);
    });

    proc.on('error', err => {
      clearTimeout(timer);
      logger.error(`Failed to spawn Codex CLI: ${err.message}`);
      reject(new Error(`Failed to execute codex CLI: ${err.message}`));
    });
  });
}

async function handleCodexToolCall(name, args) {
  logger.info(`Received Codex tool call: ${name}`);

  if (name === 'codex_design_ui') {
    const platform = args.platform || 'web-tailwind';
    const componentName = args.componentName ? ` Component: ${args.componentName}.` : '';
    const targetFile = args.targetFile ? ` Target file: ${args.targetFile}.` : '';
    const effort = resolveReasoningEffort('astra', args.reasoningEffort, args.prompt);
    const timeoutMs = resolveTimeoutMs(effort, args.timeoutSeconds);

    const systemContext = `[ROLE: CODEX ASTRA - LEAD UI/UX DESIGNER]
You are Codex Astra, the master visual designer for CraftSquad.
Platform target: ${platform}.${componentName}${targetFile}

STRICT DESIGN RULES:
1. PRODUCE PRESENTATIONAL UI SKELETONS ONLY. Do NOT write backend APIs, database calls, or complex store wiring.
2. Touch Targets: Interactive elements MUST have touch targets >= 48dp (min-h-12 / min-w-12 or 48px).
3. Safe Area Insets: For mobile layouts, account for notches, dynamic islands, and home bars (SafeArea / useSafeAreaInsets).
4. Modern Design Tokens: Use crisp typography, subtle borders, high contrast accessible colors, and sleek micro-interactions.
5. If target file is provided, generate the complete, production-ready presentational component file.

REQUIREMENT:
${args.prompt}`;

    const result = await runCodexCli({
      prompt: systemContext,
      sandbox: 'workspace-write',
      workingDirectory: args.workingDirectory,
      model: 'gpt-6-astra',
      reasoningEffort: effort,
      timeoutMs
    });

    return { content: [{ type: 'text', text: result }] };
  }

  if (name === 'codex_architect_plan') {
    const effort = resolveReasoningEffort('planner', args.reasoningEffort, args.prompt);
    const timeoutMs = resolveTimeoutMs(effort, args.timeoutSeconds);

    const systemContext = `[ROLE: CODEX PLANNER - SYSTEM & DB ARCHITECT]
You are Codex Planner, the principal software and database architect for CraftSquad.

STRICT ARCHITECTURE RULES:
1. PRODUCE ARCHITECTURAL SPECS & SCHEMAS ONLY. Do NOT write full application code.
2. Provide complete database schemas, data models, migration strategy, and data contracts.

REQUIREMENT:
${args.prompt}`;

    const result = await runCodexCli({
      prompt: systemContext,
      sandbox: 'read-only',
      workingDirectory: args.workingDirectory,
      model: 'gpt-6.1-sol',
      reasoningEffort: effort,
      timeoutMs
    });

    return { content: [{ type: 'text', text: result }] };
  }

  if (name === 'codex_security_audit') {
    const focus = args.focusAreas ? `\nFocus Areas: ${args.focusAreas}` : '';
    const effort = resolveReasoningEffort('sentinel', args.reasoningEffort, args.codeDiffOrFiles);
    const timeoutMs = resolveTimeoutMs(effort, args.timeoutSeconds);

    const systemContext = `[ROLE: CODEX SENTINEL - APPSEC & COMPLIANCE AUDITOR]
You are Codex Sentinel, the elite application security auditor for CraftSquad.

STRICT APPSEC AUDIT RULES:
1. Audit for OWASP Top 10 vulnerabilities, Supabase/Firebase RLS policies, input sanitization, secret leaks.
2. Output a structured Security Report with Severity (CRITICAL, HIGH, MEDIUM, LOW) and exact remediation snippets.

AUDIT TARGET:${focus}
${args.codeDiffOrFiles}`;

    const result = await runCodexCli({
      prompt: systemContext,
      sandbox: 'read-only',
      workingDirectory: args.workingDirectory,
      model: 'gpt-6.1-sol',
      reasoningEffort: effort,
      timeoutMs
    });

    return { content: [{ type: 'text', text: result }] };
  }

  if (name === 'codex_adversarial_review') {
    const timeoutMs = resolveTimeoutMs('high', args.timeoutSeconds);
    const systemContext = `[ROLE: CODEX SENTINEL - ADVERSARIAL REVIEWER]
You are Codex Sentinel, an adversarial reviewer performing a rigorous check against code produced by other AI coding assistants.
Your goal is NOT to flatter or compliment. Your job is to catch subtle bugs, logic flaws, race conditions, edge cases, and deviations from the specification.

${args.specOrAcceptanceCriteria ? `### SPECIFICATION / ACCEPTANCE CRITERIA:\n${args.specOrAcceptanceCriteria}\n` : ''}
### CODE DIFF / SOURCE FILES:
${args.codeDiffOrFiles}

INSTRUCTIONS:
1. Strict fidelity check against the acceptance criteria.
2. Flag edge cases, unhandled nulls, memory leaks, performance traps, and security risks.
3. Provide concrete code patches for every issue identified.
4. Conclude with a clear verdict: [PASS] or [REVISE REQUIRED].`;

    const result = await runCodexCli({
      prompt: systemContext,
      sandbox: 'read-only',
      workingDirectory: args.workingDirectory,
      model: 'gpt-6.1-sol',
      reasoningEffort: 'high',
      timeoutMs
    });

    return { content: [{ type: 'text', text: result }] };
  }

  if (name === 'codex_rescue') {
    const timeoutMs = resolveTimeoutMs('xhigh', args.timeoutSeconds);
    const systemContext = `[ROLE: CODEX RESCUE COMMANDER]
A critical task has failed multiple times in another agent session and has been escalated to you for deep reasoning resolution.

CONTEXT & GOAL:
${args.contextDescription}

ERROR LOGS / COMPILER OUTPUT:
${args.errorLogs}

INSTRUCTIONS:
1. Identify the root cause precisely without guessing.
2. Provide the complete, working code correction or architectural refactoring to solve this cleanly.`;

    const result = await runCodexCli({
      prompt: systemContext,
      sandbox: 'workspace-write',
      workingDirectory: args.workingDirectory,
      model: 'gpt-6.1-sol',
      reasoningEffort: 'xhigh',
      timeoutMs
    });

    return { content: [{ type: 'text', text: result }] };
  }

  if (name === 'codex_exec') {
    const effort = args.reasoningEffort || 'high';
    const timeoutMs = resolveTimeoutMs(effort, args.timeoutSeconds);

    const result = await runCodexCli({
      prompt: args.prompt,
      sandbox: args.sandbox || 'workspace-write',
      workingDirectory: args.workingDirectory,
      model: args.model || 'gpt-6.1-sol',
      reasoningEffort: effort,
      timeoutMs
    });

    return { content: [{ type: 'text', text: result }] };
  }

  throw new Error(`Unknown Codex tool: ${name}`);
}

module.exports = {
  CODEX_TOOLS,
  handleCodexToolCall
};
