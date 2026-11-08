#!/usr/bin/env node

/**
 * CraftSquad Multi-Engine MCP Server v2.2.0
 * Unified Model Context Protocol Server integrating:
 *  1. Dynamic Squad Engine Dispatcher (squad_dispatch, squad_get_config, squad_set_role)
 *  2. OpenAI Codex CLI (Codex Astra UI, Planner Arch, Sentinel Sec, Adversarial Review, Rescue)
 *  3. Claude Code CLI (Claude Exec, Adversarial Review, Rescue)
 */

const { CODEX_TOOLS, handleCodexToolCall } = require('./modules/codex');
const { CLAUDE_TOOLS, handleClaudeToolCall } = require('./modules/claude');
const { DISPATCHER_TOOLS, handleDispatcherToolCall } = require('./modules/dispatcher');
const { startRpcServer } = require('./shared/rpc');
const { createLogger } = require('./shared/logger');

// Check CLI arguments for server selection
const args = process.argv.slice(2);
const serverArg = args.find(a => a.startsWith('--server='));
const selectedServer = serverArg ? serverArg.split('=')[1].toLowerCase() : 'all';

let serverName = 'craft-squad-codex';
let tools = [];
let toolHandler;
let logger;

if (selectedServer === 'codex') {
  serverName = 'craft-squad-codex';
  logger = createLogger(serverName, 'craft-squad-codex.log');
  tools = CODEX_TOOLS;
  toolHandler = handleCodexToolCall;
} else if (selectedServer === 'claude') {
  serverName = 'craft-squad-claude';
  logger = createLogger(serverName, 'craft-squad-claude.log');
  tools = CLAUDE_TOOLS;
  toolHandler = handleClaudeToolCall;
} else if (selectedServer === 'dispatcher') {
  serverName = 'craft-squad-dispatcher';
  logger = createLogger(serverName, 'craft-squad-dispatcher.log');
  tools = DISPATCHER_TOOLS;
  toolHandler = handleDispatcherToolCall;
} else {
  // Unified: expose Dispatcher, Codex, and Claude tools
  serverName = 'craft-squad';
  logger = createLogger(serverName, 'craft-squad-unified.log');
  tools = [...DISPATCHER_TOOLS, ...CODEX_TOOLS, ...CLAUDE_TOOLS];
  toolHandler = async (name, toolArgs) => {
    if (name.startsWith('squad_')) {
      return handleDispatcherToolCall(name, toolArgs);
    }
    if (name.startsWith('claude_')) {
      return handleClaudeToolCall(name, toolArgs);
    }
    return handleCodexToolCall(name, toolArgs);
  };
}

startRpcServer({
  name: serverName,
  version: '2.2.0',
  tools,
  handleToolCall: toolHandler,
  logger
});
