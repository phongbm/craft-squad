/**
 * CraftSquad Tool - JSON API routes. Handlers return plain objects or throw ApiError.
 *
 *   GET  /api/accounts                          both providers' accounts
 *   GET  /api/accounts/:provider/pending/:token progress of a browser sign-in
 *   POST /api/accounts/:provider/:action        add | cancel | switch | rotate | save | sync | restart-daemon | use | remove | command
 *   GET  /api/doctor/:provider                  diagnostics
 *   GET  /api/status                            CLI availability
 *   GET  /api/config, POST /api/config/role     squad roles
 */

const { ApiError } = require('./errors');
const { getEngineStatus } = require('./engine-status');
const { getSquadConfig, updateRoleConfig } = require('./squad-manager');
const runtime = require('./codex/runtime');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function needString(body, key) {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim() || value.length > 300) throw new ApiError(400, `"${key}" is required.`);
  return value.trim();
}

function section(fn) {
  try {
    return fn();
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Could not read accounts.', accounts: [], pending: [] };
  }
}

function createApi({ codex, claude }) {
  const providers = { codex, claude };

  const actions = {
    codex: {
      add: () => codex.add(),
      cancel: (b) => codex.cancel(needString(b, 'token')),
      switch: (b) => codex.switchTo(needString(b, 'id'), { restartDaemon: b.restartDaemon !== false }),
      rotate: (b) => codex.rotate({ restartDaemon: b.restartDaemon !== false }),
      remove: (b) => codex.remove(needString(b, 'id')),
      save: () => codex.saveLive(),
      sync: () => codex.sync(),
      'restart-daemon': () => runtime.restartDaemon()
    },
    claude: {
      add: (b) => {
        const email = typeof b.email === 'string' ? b.email.trim() : '';
        if (email && !EMAIL.test(email)) throw new ApiError(400, 'Enter a valid email address.');
        return claude.add({ email: email || undefined });
      },
      cancel: (b) => claude.cancel(needString(b, 'token')),
      use: (b) => claude.use(needString(b, 'id')),
      remove: (b) => claude.remove(needString(b, 'id')),
      command: (b) => claude.launchCommand(needString(b, 'id'), typeof b.shell === 'string' ? b.shell : undefined)
    }
  };

  return async function api({ method, pathname, query, body }) {
    const parts = pathname.replace(/^\/api\//, '').split('/').filter(Boolean).map(decodeURIComponent);

    if (method === 'GET') {
      if (parts[0] === 'accounts' && parts.length === 1) {
        return { codex: section(() => codex.list()), claude: section(() => claude.list()) };
      }
      if (parts[0] === 'accounts' && parts[2] === 'pending' && parts.length === 4) {
        const svc = providers[parts[1]];
        if (!svc) throw new ApiError(404, 'Unknown provider.');
        return svc.pending(parts[3]);
      }
      if (parts[0] === 'doctor' && parts.length === 2) {
        const svc = providers[parts[1]];
        if (!svc) throw new ApiError(404, 'Unknown provider.');
        return svc.doctor();
      }
      if (parts[0] === 'status' && parts.length === 1) return getEngineStatus({ force: query.get('refresh') === '1' });
      if (parts[0] === 'config' && parts.length === 1) return getSquadConfig();
      throw new ApiError(404, 'Not found.');
    }

    if (method === 'POST') {
      if (parts[0] === 'accounts' && parts.length === 3) {
        const table = actions[parts[1]];
        const handler = table && Object.prototype.hasOwnProperty.call(table, parts[2]) ? table[parts[2]] : null;
        if (!handler) throw new ApiError(404, 'Unknown action.');
        return handler(body);
      }
      if (parts[0] === 'config' && parts[1] === 'role' && parts.length === 2) {
        return updateRoleConfig(body.role, body);
      }
      throw new ApiError(404, 'Not found.');
    }

    throw new ApiError(405, 'Method not allowed.');
  };
}

module.exports = { createApi };
