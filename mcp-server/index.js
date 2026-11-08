#!/usr/bin/env node

/**
 * CraftSquad MCP Server
 * Single stdio server exposing: squad_dispatch, squad_get_config, squad_set_role.
 */

const { getDispatcherTools, handleDispatcherToolCall } = require('./modules/dispatcher');
const { startRpcServer } = require('./shared/rpc');
const { createLogger } = require('./shared/logger');

startRpcServer({
  name: 'craft-squad',
  version: require('../package.json').version,
  tools: getDispatcherTools,
  handleToolCall: handleDispatcherToolCall,
  logger: createLogger('craft-squad', 'craft-squad.log')
});
