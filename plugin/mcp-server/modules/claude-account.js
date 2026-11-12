/**
 * CraftSquad - selected Claude Code account.
 *
 * The local Studio (tool/) lets the user mark one Claude account as "in use". Each account is a CLAUDE_CONFIG_DIR
 * under ~/.craft-squad/claude-profiles/<id>/ (override: CX_CLAUDE_HOME) and the choice is stored in state.json.
 * Dispatch reads it at call time so switching accounts needs no restart. Returns null for the system default login.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function claudeProfilesRoot(env = process.env) {
  return path.resolve(env.CX_CLAUDE_HOME || path.join(os.homedir(), '.craft-squad', 'claude-profiles'));
}

/** @returns {{ id: string, dir: string } | null} */
function selectedClaudeAccount(env = process.env) {
  try {
    const root = claudeProfilesRoot(env);
    const state = JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8'));
    const id = state && state.active_id;
    if (!id || typeof id !== 'string' || /^[._]/.test(id) || /[\\/]/.test(id)) return null;
    const dir = path.join(root, id);
    return fs.statSync(dir).isDirectory() ? { id, dir } : null;
  } catch (_) {
    return null;
  }
}

module.exports = { selectedClaudeAccount, claudeProfilesRoot };
