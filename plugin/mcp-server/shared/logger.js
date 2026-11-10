/**
 * CraftSquad MCP Server - Shared Structured Logger
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const GLOBAL_LOG_DIR = path.join(os.homedir(), '.gemini', 'logs');

try {
  if (!fs.existsSync(GLOBAL_LOG_DIR)) {
    fs.mkdirSync(GLOBAL_LOG_DIR, { recursive: true });
  }
} catch (e) {
  // Ignore failure to create global log dir
}

function rotateLogIfNeeded(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) {
        const oldFile = `${filePath}.old`;
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
        fs.renameSync(filePath, oldFile);
      }
    }
  } catch (e) {
    // Ignore rotation error
  }
}

function createLogger(serverName, logFileName) {
  const globalLogFile = path.join(GLOBAL_LOG_DIR, logFileName || `${serverName}.log`);

  function writeLog(level, message, extra = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    let logLine = `[${timestamp}] [${level}] [PID:${pid}] ${message}`;

    if (extra && Object.keys(extra).length > 0) {
      try {
        logLine += ` | ${JSON.stringify(extra)}`;
      } catch (e) {
        logLine += ` | [unserializable metadata]`;
      }
    }
    logLine += '\n';

    // 1. Write to stderr for stdio debuggers
    try {
      process.stderr.write(`[${serverName}] [${level}] ${message}\n`);
    } catch (e) {}

    // 2. Append to global log file
    try {
      rotateLogIfNeeded(globalLogFile);
      fs.appendFileSync(globalLogFile, logLine, 'utf8');
    } catch (e) {}

    // 3. Append to project-specific log if available
    if (extra && extra.projectCwd) {
      try {
        const projectLogsDir = path.join(extra.projectCwd, '.agents', 'logs');
        if (fs.existsSync(path.join(extra.projectCwd, '.agents'))) {
          if (!fs.existsSync(projectLogsDir)) {
            fs.mkdirSync(projectLogsDir, { recursive: true });
          }
          const projectLogFile = path.join(projectLogsDir, `${serverName}.log`);
          rotateLogIfNeeded(projectLogFile);
          fs.appendFileSync(projectLogFile, logLine, 'utf8');
        }
      } catch (e) {}
    }
  }

  return {
    info: (msg, extra) => writeLog('INFO', msg, extra),
    warn: (msg, extra) => writeLog('WARN', msg, extra),
    error: (msg, extra) => writeLog('ERROR', msg, extra),
    debug: (msg, extra) => writeLog('DEBUG', msg, extra)
  };
}

module.exports = {
  createLogger
};
