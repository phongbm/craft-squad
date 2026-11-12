/**
 * CraftSquad Tool - Claude Code accounts.
 *
 * Every account is its own CLAUDE_CONFIG_DIR under <root>/<id>/ (default root ~/.craft-squad/claude-profiles,
 * override CX_CLAUDE_HOME). Nothing is copied between accounts, so refresh tokens never collide and accounts can
 * run side by side. A read-only "System default" entry stands for the normal ~/.claude login.
 * The account marked "in use" is the one CraftSquad dispatch runs Claude Code with.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { AccountStore } = require('../account-store');
const { ApiError } = require('../errors');
const { PendingLogins } = require('../pending');
const { ensureDir, readJson } = require('../fs-utils');
const runtime = require('./runtime');

const DEFAULT_ROOT = path.join(os.homedir(), '.craft-squad', 'claude-profiles');
const SYSTEM_ID = 'system';

/** Identity from a Claude config dir: account details live in <state file>, sign-in tokens in <dir>/.credentials.json. */
function readClaudeIdentity(dir, stateFile) {
  const acc = (readJson(stateFile) || {}).oauthAccount || {};
  if (!acc.emailAddress) return null;
  const oauth = (readJson(path.join(dir, '.credentials.json')) || {}).claudeAiOauth || {};
  return {
    email: acc.emailAddress,
    name: acc.displayName || acc.fullName || null,
    accountId: acc.accountUuid || null,
    plan: oauth.subscriptionType || null,
    organization: acc.organizationName || null,
    signedIn: Boolean(oauth.refreshToken || oauth.accessToken)
  };
}

function shellSnippet(dir, shell) {
  const kind = shell || (process.platform === 'win32' ? 'powershell' : 'sh');
  if (kind === 'powershell') return `$env:CLAUDE_CONFIG_DIR = '${dir.replace(/'/g, "''")}'; claude`;
  if (kind === 'cmd') return `set "CLAUDE_CONFIG_DIR=${dir}" && claude`;
  return `CLAUDE_CONFIG_DIR='${dir.replace(/'/g, "'\\''")}' claude`;
}

class ClaudeService {
  constructor({ root, systemDir } = {}) {
    this.root = path.resolve(root || process.env.CX_CLAUDE_HOME || DEFAULT_ROOT);
    const home = os.homedir();
    this.systemDir = path.resolve(systemDir || process.env.CX_CLAUDE_SYSTEM_DIR || path.join(home, '.claude'));
    this.systemState = process.env.CX_CLAUDE_SYSTEM_DIR || systemDir ? path.join(this.systemDir, '.claude.json') : path.join(home, '.claude.json');
    this.store = new AccountStore({ root: this.root, readIdentity: (dir) => readClaudeIdentity(dir, path.join(dir, '.claude.json')) });
    this.logins = new PendingLogins();
  }

  systemIdentity() {
    return readClaudeIdentity(this.systemDir, this.systemState);
  }

  activeId() {
    this.store.ensure();
    const id = this.store.getState().active_id;
    return id && this.store.scan().some((a) => a.id === id) ? id : SYSTEM_ID;
  }

  list() {
    this.store.ensure();
    const active = this.activeId();
    const sys = this.systemIdentity();
    const rows = [{
      id: SYSTEM_ID, index: 0, isSystem: true, email: sys ? sys.email : null, name: sys ? sys.name : null,
      plan: sys ? sys.plan : null, organization: sys ? sys.organization : null,
      status: sys ? 'ready' : 'needs-signin', isActive: active === SYSTEM_ID
    }];
    for (const a of this.store.list()) {
      rows.push({
        id: a.id, index: a.index, isSystem: false, email: a.identity.email, name: a.identity.name, plan: a.identity.plan,
        organization: a.identity.organization, status: a.identity.signedIn ? 'ready' : 'needs-signin', isActive: active === a.id
      });
    }
    return { provider: 'claude', root: this.root, accounts: rows, pending: this.logins.list('claude'), notes: [...this.store.notes] };
  }

  resolve(selector) {
    const sel = String(selector === undefined || selector === null ? '' : selector).trim().toLowerCase();
    if (sel === SYSTEM_ID || sel === '0') return { id: SYSTEM_ID, dir: this.systemDir, isSystem: true, email: (this.systemIdentity() || {}).email || null };
    const a = this.store.select(selector);
    return { id: a.id, dir: a.dir, isSystem: false, email: a.identity.email };
  }

  /** Mark an account as the one CraftSquad dispatch (and `cx claude run`) uses. */
  use(selector) {
    const account = this.resolve(selector);
    this.store.patchState({ active_id: account.isSystem ? null : account.id, last_switched_at: new Date().toISOString() });
    return { id: account.id, email: account.email };
  }

  remove(selector) {
    const account = this.resolve(selector);
    if (account.isSystem) throw new ApiError(400, 'The system default login cannot be removed here. Use "claude auth logout" instead.');
    if (this.activeId() === account.id) this.store.patchState({ active_id: null });
    this.store.remove(account.id);
    return { removed: account.id, email: account.email };
  }

  launchCommand(selector, shell) {
    const account = this.resolve(selector);
    return { id: account.id, command: account.isSystem ? 'claude' : shellSnippet(account.dir, shell) };
  }

  /** Start a browser sign-in into a hidden pending folder; on success it is renamed to the account's id. */
  async add({ email } = {}) {
    this.store.ensure();
    const bin = await runtime.findClaudeBinary();
    if (!bin) throw new ApiError(409, 'Claude Code CLI not found. Install it with: npm i -g @anthropic-ai/claude-code');
    const pendingDir = path.join(this.root, `_pending-${crypto.randomBytes(4).toString('hex')}`);
    ensureDir(pendingDir);
    const token = this.logins.start({
      provider: 'claude',
      start: () => runtime.startLogin(bin, pendingDir, email),
      finalize: () => {
        const identity = readClaudeIdentity(pendingDir, path.join(pendingDir, '.claude.json'));
        if (!identity) throw new Error('Sign-in finished but no account was found.');
        const existing = this.store.find(identity);
        if (existing) {
          fs.rmSync(pendingDir, { recursive: true, force: true });
          return { id: existing.id, email: identity.email, created: false };
        }
        const id = this.store.idFor(identity);
        fs.renameSync(pendingDir, this.store.dirOf(id));
        this.store.writeMeta(id, identity);
        return { id, email: identity.email, created: true };
      },
      cleanup: () => fs.rmSync(pendingDir, { recursive: true, force: true })
    });
    return { token };
  }

  pending(token) {
    const item = this.logins.get(token);
    if (!item) throw new ApiError(404, 'That sign-in is no longer tracked.');
    return item;
  }

  cancel(token) {
    return { cancelled: this.logins.cancel(token) };
  }

  async run(selector, args = []) {
    const account = this.resolve(selector);
    const bin = await runtime.findClaudeBinary();
    if (!bin) throw new ApiError(409, 'Claude Code CLI not found.');
    return runtime.runInteractive(bin, account.isSystem ? null : account.dir, args);
  }

  async doctor() {
    this.store.ensure();
    const bin = await runtime.findClaudeBinary();
    const accounts = this.store.list();
    const sys = this.systemIdentity();
    return {
      binary: bin || 'Not found',
      version: (await runtime.claudeVersion()) || 'Not installed',
      accountsRoot: this.root,
      systemAccount: sys ? sys.email : 'Not signed in',
      accounts: `${accounts.filter((a) => a.identity.signedIn).length}/${accounts.length} signed in`,
      inUse: this.activeId(),
      note: process.platform === 'darwin' ? 'macOS keeps Claude credentials in the Keychain; verify per-account isolation before relying on this.' : null
    };
  }
}

module.exports = { ClaudeService, readClaudeIdentity, shellSnippet, DEFAULT_ROOT, SYSTEM_ID };
