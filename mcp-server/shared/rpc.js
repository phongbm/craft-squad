/**
 * CraftSquad MCP Server - Shared JSON-RPC 2.0 Stdio Handler
 */

const readline = require('readline');

function sendResponse(id, result, error) {
  const payload = { jsonrpc: '2.0', id };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result;
  }
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function startRpcServer({ name, version, tools, handleToolCall, logger }) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  logger.info(`Starting MCP Server: ${name} v${version}`);

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req;
    try {
      req = JSON.parse(trimmed);
    } catch (e) {
      logger.error('Failed to parse JSON-RPC line', { line: trimmed, error: e.message });
      sendResponse(null, null, { code: -32700, message: 'Parse error' });
      return;
    }

    const { id, method, params } = req;
    logger.debug(`Received RPC: ${method}`, { id });

    try {
      if (method === 'initialize') {
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name,
            version
          }
        });
        return;
      }

      if (method === 'notifications/initialized') {
        logger.info('Client confirmed initialization');
        return;
      }

      if (method === 'ping') {
        sendResponse(id, {});
        return;
      }

      if (method === 'tools/list') {
        logger.debug('Handling tools/list');
        sendResponse(id, {
          tools: typeof tools === 'function' ? tools() : tools
        });
        return;
      }

      if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        logger.info(`Executing tool call: ${toolName}`);

        const result = await handleToolCall(toolName, toolArgs);
        sendResponse(id, result);
        return;
      }

      logger.warn(`Method not found: ${method}`);
      sendResponse(id, null, {
        code: -32601,
        message: `Method '${method}' not found`
      });
    } catch (err) {
      logger.error(`Error handling method ${method}`, { error: err.message, stack: err.stack });
      sendResponse(id, null, {
        code: -32603,
        message: err.message || 'Internal RPC error'
      });
    }
  });

  rl.on('close', () => {
    logger.info('Stdin closed, terminating MCP Server.');
    process.exit(0);
  });
}

module.exports = {
  sendResponse,
  startRpcServer
};
