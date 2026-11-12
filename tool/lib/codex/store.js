/**
 * CraftSquad Tool - Codex accounts.
 *
 * Saved accounts live in <root>/<id>/auth.json (default root: ~/.craft-squad/codex-profiles, override CX_CODEX_HOME).
 * Codex itself reads the live login from <CODEX_HOME>/auth.json (default ~/.codex), so switching copies the chosen
 * account there. Safety rules:
 *   - the active account is derived from the live login's identity, never from stored state;
 *   - tokens are synced back only into the account whose identity matches the live login;
 *   - the live login is always saved or backed up before it is overwritten.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { AccountStore, sameAccount } = require('../account-store');
const { ApiError } = require('../errors');
const { PendingLogins } = require('../pending');
const { ensureDir, atomicCopyFile } = require('../fs-utils');
const { readAuthIdentity } = require('./auth');
const runtime = require('./runtime');

const DEFAULT_ROOT = path.join(os.homedir(), '.craft-squad', 'codex-profiles');
const KEEP_BACKUPS = 3;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function hasDirs(dir) {
  return fs.existsSync(dir) && fs.readdirSync(dir, { withFileTypes: true }).some((e) => e.isDirectory());
}

/** Move profiles saved by older versions (<CODEX_HOME>/profiles) into the new root once. Leaves the legacy folder on any failure. */
function migrateLegacyProfiles(legacyDir, root) {
  if (path.resolve(legacyDir) === path.resolve(root) || !hasDirs(legacyDir) || hasDirs(root)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(legacyDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const src = path.join(legacyDir, entry.name);
    const dest = path.join(root, entry.name);
    fs.cpSync(src, dest, { recursive: true });
    if (fs.existsSync(path.join(src, 'auth.json')) && !fs.existsSync(path.join(dest, 'auth.json'))) {
      throw new Error(`Profile migration failed for "${entry.name}"; legacy folder left untouched at ${legacyDir}`);
    }
    count += 1;
  }
  fs.rmSync(legacyDir, { recursive: true, force: true });
  return count;
}

class CodexService {
  constructor({ codexHome, root } = {}) {
    this.codexHome = path.resolve(codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
    this.authFile = path.join(this.codexHome, 'auth.json');
    this.root = path.resolve(root || process.env.CX_CODEX_HOME || DEFAULT_ROOT);
    this.store = new AccountStore({ root: this.root, readIdentity: (dir) => readAuthIdentity(path.join(dir, 'auth.json')) });
    this.logins = new PendingLogins();
    this.legacyMigrated = 0;
  }

  ensure() {
    if (this.store.ready) return;
    ensureDir(this.root);
    this.legacyMigrated = migrateLegacyProfiles(path.join(this.codexHome, 'profiles'), this.root);
    this.store.ensure();
  }

  liveIdentity() {
    return readAuthIdentity(this.authFile);
  }

  list() {
    this.ensure();
    const live = this.liveIdentity();
    const accounts = this.store.list().map((a) => ({
      id: a.id,
      index: a.index,
      email: a.identity.email,
      name: a.identity.name,
      plan: a.identity.plan,
      accountId: a.identity.accountId,
      isActive: sameAccount(a.identity, live),
      status: a.identity.hasRefreshToken ? 'ready' : 'needs-signin',
      updatedAt: a.meta.updated_at || null
    }));
    return {
      provider: 'codex',
      root: this.root,
      live: live ? { email: live.email, name: live.name, plan: live.plan } : null,
      liveSaved: !live || accounts.some((a) => a.isActive),
      accounts,
      pending: this.logins.list('codex'),
      notes: [...this.store.notes, ...(this.legacyMigrated ? [`Moved ${this.legacyMigrated} saved account(s) to ${this.root}.`] : [])]
    };
  }

  /** Save (or refresh) an account from an auth.json file. Same account updates in place; never duplicates. */
  importAuth(file) {
    this.ensure();
    const identity = readAuthIdentity(file);
    if (!identity) throw new ApiError(400, 'That login has no ChatGPT account. API-key logins cannot be switched.');
    const existing = this.store.find(identity);
    const id = existing ? existing.id : this.store.idFor(identity);
    atomicCopyFile(file, path.join(this.store.dirOf(id), 'auth.json'));
    this.store.writeMeta(id, identity);
    return { id, email: identity.email, created: !existing };
  }

  saveLive() {
    if (!fs.existsSync(this.authFile)) throw new ApiError(409, 'No Codex login found. Sign in with Codex first.');
    return this.importAuth(this.authFile);
  }

  backupLive() {
    if (!fs.existsSync(this.authFile)) return null;
    const dir = path.join(this.root, '.backup');
    ensureDir(dir);
    const file = path.join(dir, `auth-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    atomicCopyFile(this.authFile, file);
    const old = fs.readdirSync(dir).filter((n) => n.startsWith('auth-')).sort().slice(0, -KEEP_BACKUPS);
    old.forEach((n) => fs.rmSync(path.join(dir, n), { force: true }));
    return file;
  }

  /** Copy refreshed tokens from the live login back into the saved account with the SAME identity. */
  sync() {
    this.ensure();
    const live = this.liveIdentity();
    if (!live) return { synced: null };
    const match = this.store.find(live);
    if (!match) return { synced: null };
    const saved = path.join(match.dir, 'auth.json');
    if (sha256(saved) !== sha256(this.authFile)) {
      atomicCopyFile(this.authFile, saved);
      this.store.writeMeta(match.id, live);
      return { synced: match.id, email: match.identity.email };
    }
    return { synced: null, upToDate: match.id };
  }

  async switchTo(selector, { restartDaemon = true } = {}) {
    this.ensure();
    const target = this.store.select(selector);
    if (!target.identity.hasRefreshToken) throw new ApiError(409, `${target.identity.email} needs to sign in again.`);
    const live = this.liveIdentity();
    const result = { id: target.id, email: target.identity.email, autoSaved: null, daemon: null, openProcesses: 0 };

    if (live && sameAccount(live, target.identity)) {
      this.sync();
      return { ...result, alreadyActive: true };
    }
    if (live) {
      if (!this.store.find(live)) result.autoSaved = this.saveLive().email;
      else this.sync();
      this.backupLive();
    }
    atomicCopyFile(path.join(target.dir, 'auth.json'), this.authFile);
    this.store.patchState({ last_switched_at: new Date().toISOString() });
    result.openProcesses = await runtime.codexProcessCount();
    if (restartDaemon) result.daemon = await runtime.restartDaemon();
    return result;
  }

  async rotate(options) {
    this.ensure();
    const accounts = this.store.list().filter((a) => a.identity.hasRefreshToken);
    const live = this.liveIdentity();
    if (accounts.length < 2 && !(accounts.length === 1 && !sameAccount(accounts[0].identity, live))) {
      throw new ApiError(409, 'No other account is ready to switch to.');
    }
    const at = accounts.findIndex((a) => sameAccount(a.identity, live));
    return this.switchTo(accounts[(at + 1) % accounts.length].id, options);
  }

  remove(selector) {
    this.ensure();
    const account = this.store.remove(selector);
    return { removed: account.id, email: account.identity.email };
  }

  /** Start a browser sign-in in an isolated CODEX_HOME; the live login is not touched. */
  async add() {
    this.ensure();
    const bin = await runtime.findCodexBinary();
    if (!bin) throw new ApiError(409, 'Codex CLI not found. Install it with: npm i -g @openai/codex');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-codex-login-'));
    const cleanup = () => fs.rmSync(home, { recursive: true, force: true });
    const token = this.logins.start({
      provider: 'codex',
      start: () => runtime.startLogin(bin, home),
      finalize: () => {
        const file = path.join(home, 'auth.json');
        if (!fs.existsSync(file)) throw new Error('Sign-in finished but no login was found.');
        return this.importAuth(file);
      },
      cleanup
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

  async doctor() {
    this.ensure();
    const bin = await runtime.findCodexBinary();
    const live = this.liveIdentity();
    const accounts = this.store.list();
    return {
      binary: bin || 'Not found',
      version: (await runtime.codexVersion()) || 'Not installed',
      codexHome: this.codexHome,
      accountsRoot: this.root,
      liveAccount: live ? live.email : 'None',
      liveSaved: !live || Boolean(this.store.find(live)),
      accounts: `${accounts.filter((a) => a.identity.hasRefreshToken).length}/${accounts.length} ready`,
      openProcesses: await runtime.codexProcessCount()
    };
  }
}

module.exports = { CodexService, migrateLegacyProfiles, DEFAULT_ROOT };
