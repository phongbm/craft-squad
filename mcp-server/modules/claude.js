/**
 * CraftSquad - Claude Code Module
 * Bridges Antigravity 2.0 to Claude Code CLI via Model Context Protocol.
 * Uses local Claude Code CLI environment (~/.claude.json).
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createLogger } = require('../shared/logger');

const logger = createLogger('craft-squad-claude', 'craft-squad-claude.log');

const CLAUDE_TOOLS = [
  {
    name: 'claude_code_exec',
    description: 'Execute deep engineering, refactoring, or algorithmic tasks using Claude Code CLI (Sonnet 3.7).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed instructions or task description for Claude Code to execute.'
        },
        workingDirectory: {
          type: 'string',
          description: 'Optional project root working directory.'
        },
        model: {
          type: 'string',
          description: 'Optional Claude model override (e.g., "claude-3-7-sonnet-latest" or "sonnet").'
        },
        dangerouslySkipPermissions: {
          type: 'boolean',
          description: 'Whether to bypass interactive permission prompts for non-interactive execution (default: true).'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 300s).'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'claude_adversarial_review',
    description: 'Perform an adversarial, hyper-critical code review using Claude Code (Sonnet 3.7) to detect subtle edge cases, architectural flaws, state desync, and security risks in code produced by Gemini or Codex.',
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
          description: 'Optional project root working directory.'
        },
        timeoutSeconds: {
          type: 'integer',
          description: 'Optional execution timeout in seconds (default: 300s).'
        }
      },
      required: ['codeDiffOrFiles']
    }
  },
  {
    name: 'claude_rescue',
    description: 'Escalate a persistently failing task, compiler error loop, or tricky bug to Claude Code (Sonnet 3.7) with fresh context when other agents are stuck.',
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
          description: 'Optional project root working directory.'
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
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-proc.pid, 'SIGKILL');
    }
  } catch (e) {
    // Process might already be terminated
  }
}

function runClaudeCli({ prompt, workingDirectory, model, dangerouslySkipPermissions = true, timeoutMs = 300000 }) {
  return new Promise((resolve, reject) => {
    let cwd = workingDirectory ? path.resolve(workingDirectory) : process.cwd();
    if (!fs.existsSync(cwd)) {
      logger.warn(`Provided workingDirectory does not exist: "${workingDirectory}". Falling back to: "${process.cwd()}"`);
      cwd = process.cwd();
    }

    const args = ['-p'];
    if (dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }
    if (model) {
      args.push('--model', model);
    }
    args.push(prompt);

    const startTime = Date.now();
    logger.info('Starting Claude Code CLI execution', {
      projectCwd: cwd,
      model: model || 'default',
      dangerouslySkipPermissions,
      timeoutMs,
      promptSnippet: prompt.length > 200 ? prompt.substring(0, 200) + '...' : prompt
    });

    let proc;
    if (process.platform === 'win32') {
      proc = spawn('cmd.exe', ['/c', 'claude', ...args], {
        cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'] // ignore stdin so it doesn't hang waiting for stdin
      });
    } else {
      proc = spawn('claude', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => { stdout += data.toString(); });
    proc.stderr.on('data', data => { stderr += data.toString(); });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      logger.error(`Claude Code CLI execution timed out after ${timeoutMs / 1000}s`);
      killProcessTree(proc);
      reject(new Error(`Claude Code CLI execution timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return;

      const durationMs = Date.now() - startTime;
      logger.info(`Claude Code CLI finished with exit code ${code} (${(durationMs / 1000).toFixed(1)}s)`);

      const outputText = stdout.trim() || stderr.trim();

      if (code !== 0 && !outputText) {
        logger.error(`Claude Code CLI failed with exit code ${code}`, { stderr, stdout });
        return reject(new Error(`Claude Code CLI failed with exit code ${code}: ${stderr || 'Unknown error'}`));
      }

      resolve({
        code,
        output: outputText,
        elapsedSeconds: (durationMs / 1000).toFixed(1)
      });
    });

    proc.on('error', err => {
      clearTimeout(timer);
      logger.error('Failed to spawn Claude Code CLI process', { error: err.message });
      reject(err);
    });
  });
}

async function handleClaudeToolCall(toolName, args) {
  logger.info(`Handling Claude tool call: ${toolName}`, { args });

  switch (toolName) {
    case 'claude_code_exec': {
      const { prompt, workingDirectory, model, dangerouslySkipPermissions, timeoutSeconds } = args;
      const timeoutMs = (timeoutSeconds && Number(timeoutSeconds) > 0) ? Number(timeoutSeconds) * 1000 : 300000;

      const result = await runClaudeCli({
        prompt,
        workingDirectory,
        model,
        dangerouslySkipPermissions: dangerouslySkipPermissions !== false,
        timeoutMs
      });

      return {
        content: [
          {
            type: 'text',
            text: `[Claude Code Result (Exit Code ${result.code}, Elapsed: ${result.elapsedSeconds}s)]\n\n${result.output}`
          }
        ]
      };
    }

    case 'claude_adversarial_review': {
      const { codeDiffOrFiles, specOrAcceptanceCriteria, workingDirectory, timeoutSeconds } = args;
      const timeoutMs = (timeoutSeconds && Number(timeoutSeconds) > 0) ? Number(timeoutSeconds) * 1000 : 300000;

      const reviewPrompt = [
        'You are an expert Adversarial Code Reviewer acting as a skeptical Senior Staff Engineer.',
        'Your goal is NOT to flatter or say the code looks good.',
        'Your goal is to find subtle bugs, architectural deviations, race conditions, edge-case failures, and unhandled errors.',
        '',
        specOrAcceptanceCriteria ? `### SPECIFICATION / ACCEPTANCE CRITERIA:\n${specOrAcceptanceCriteria}\n` : '',
        `### CODE DIFF / SOURCE FILES TO AUDIT:\n${codeDiffOrFiles}\n`,
        '### INSTRUCTIONS:',
        '1. Check strict fidelity to the Specification/Acceptance Criteria.',
        '2. Audit state management, null-safety, error handling, and performance pitfalls.',
        '3. Provide actionable fixes or code patches for every finding.',
        '4. Conclude with a clear verdict: [PASS] or [REVISE REQUIRED] with a prioritized issue list.'
      ].join('\n');

      const result = await runClaudeCli({
        prompt: reviewPrompt,
        workingDirectory,
        dangerouslySkipPermissions: true,
        timeoutMs
      });

      return {
        content: [
          {
            type: 'text',
            text: `[Claude Adversarial Review (Elapsed: ${result.elapsedSeconds}s)]\n\n${result.output}`
          }
        ]
      };
    }

    case 'claude_rescue': {
      const { errorLogs, contextDescription, workingDirectory, timeoutSeconds } = args;
      const timeoutMs = (timeoutSeconds && Number(timeoutSeconds) > 0) ? Number(timeoutSeconds) * 1000 : 360000;

      const rescuePrompt = [
        '### RESCUE MISSION: RESOLVE PERSISTENT FAILURE',
        'You are acting as an Elite Debugger & Rescue Engineer.',
        'A task has failed multiple times in another agent session and requires your frontier reasoning to resolve.',
        '',
        `### CONTEXT & INTENDED GOAL:\n${contextDescription}\n`,
        `### DETAILED ERROR LOGS / COMPILER OUTPUT:\n${errorLogs}\n`,
        '### INSTRUCTIONS:',
        '1. Identify the exact root cause of the error (do not guess; analyze the stack trace/compiler message).',
        '2. Provide the precise, complete fix or file edits required to resolve the issue cleanly.',
        '3. Ensure no regressions or broken types are introduced.'
      ].join('\n');

      const result = await runClaudeCli({
        prompt: rescuePrompt,
        workingDirectory,
        dangerouslySkipPermissions: true,
        timeoutMs
      });

      return {
        content: [
          {
            type: 'text',
            text: `[Claude Rescue Response (Elapsed: ${result.elapsedSeconds}s)]\n\n${result.output}`
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown Claude tool: ${toolName}`);
  }
}

module.exports = {
  CLAUDE_TOOLS,
  handleClaudeToolCall,
  runClaudeCli
};
