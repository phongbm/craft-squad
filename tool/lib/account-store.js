/**
 * CraftSquad Tool - shared account store.
 * Accounts are identified by their login identity (email, plus account id when it disambiguates), never by a
 * user-chosen name. Each account is a folder <root>/<id>/ with a meta.json; the provider decides what else lives
 * inside and how to read an identity from it.
 */

const fs = require('fs');
const path = require('path');
const { ApiError } = require('./errors');
const { ensureDir, slugify, atomicWriteJson, readJson } = require('./fs-utils');

/** Two identities are the same account when account ids match, or (if either lacks one) when emails match. */
function sameAccount(a, b) {
  if (!a || !b) return false;
  if (a.accountId && b.accountId) return a.accountId === b.accountId;
  return Boolean(a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase());
}

class AccountStore {
  /**
   * @param {{ root: string, readIdentity: (dir: string) => (null|{email:string,accountId?:string,name?:string,plan?:string}) }} opts
   */
  constructor({ root, readIdentity }) {
    this.root = path.resolve(root);
    this.readIdentity = readIdentity;
    this.notes = [];
    this.ready = false;
  }

  dirOf(id) {
    return path.join(this.root, id);
  }

  ensure() {
    if (this.ready) return;
    ensureDir(this.root);
    this.ready = true;
    this.migrate();
  }

  get statePath() {
    return path.join(this.root, 'state.json');
  }

  getState() {
    return readJson(this.statePath) || {};
  }

  patchState(patch) {
    atomicWriteJson(this.statePath, { ...this.getState(), ...patch });
  }

  /** Raw scan: every real account folder (hidden/pending folders start with . or _). */
  scan() {
    if (!fs.existsSync(this.root)) return [];
    return fs.readdirSync(this.root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !/^[._]/.test(e.name))
      .map((e) => {
        const dir = this.dirOf(e.name);
        const identity = this.readIdentity(dir);
        return { id: e.name, dir, meta: readJson(path.join(dir, 'meta.json')) || {}, identity };
      });
  }

  /** Accounts sorted by email, with a 1-based index for CLI selection. */
  list() {
    this.ensure();
    const accounts = this.scan().filter((a) => a.identity && a.identity.email);
    accounts.sort((a, b) => a.identity.email.localeCompare(b.identity.email));
    accounts.forEach((a, i) => { a.index = i + 1; });
    return accounts;
  }

  find(identity) {
    return this.list().find((a) => sameAccount(a.identity, identity)) || null;
  }

  /** Stable id for an identity: the email slug, plus a short account id only when another account already owns the slug. */
  idFor(identity, ignoreId) {
    const base = slugify(identity.email);
    const owner = this.scan().find((a) => a.id === base && a.id !== ignoreId);
    if (!owner || sameAccount(owner.identity, identity)) return base;
    const suffix = String(identity.accountId || Date.now().toString(36)).replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase();
    return `${base}~${suffix}`;
  }

  /** Resolve an id, a list index, or a unique email prefix. */
  select(selector) {
    const accounts = this.list();
    if (!accounts.length) throw new ApiError(404, 'No accounts saved yet.');
    const sel = String(selector === undefined || selector === null ? '' : selector).trim().toLowerCase();
    if (!sel) throw new ApiError(400, 'Choose an account.');
    if (/^\d+$/.test(sel)) {
      const byIndex = accounts.find((a) => a.index === Number(sel));
      if (byIndex) return byIndex;
      throw new ApiError(404, `No account number ${sel}. Choose 1 to ${accounts.length}.`);
    }
    const exact = accounts.find((a) => a.id.toLowerCase() === sel || a.identity.email.toLowerCase() === sel);
    if (exact) return exact;
    const matches = accounts.filter((a) => a.identity.email.toLowerCase().startsWith(sel));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) throw new ApiError(409, `"${selector}" matches several accounts: ${matches.map((a) => a.identity.email).join(', ')}.`);
    throw new ApiError(404, `No account matches "${selector}".`);
  }

  writeMeta(id, identity, extra = {}) {
    const file = path.join(this.dirOf(id), 'meta.json');
    const old = readJson(file) || {};
    const now = new Date().toISOString();
    atomicWriteJson(file, {
      id,
      email: identity.email,
      name: identity.name || null,
      accountId: identity.accountId || null,
      plan: identity.plan || null,
      created_at: extra.created_at || old.created_at || now,
      updated_at: now
    });
  }

  remove(selector) {
    const account = this.select(selector);
    fs.rmSync(account.dir, { recursive: true, force: true });
    return account;
  }

  /** Rename folders created by older versions (named after aliases) to their identity id. Never overwrites. */
  migrate() {
    for (const entry of this.scan()) {
      if (!entry.identity || !entry.identity.email) continue;
      const target = this.idFor(entry.identity, entry.id);
      let id = entry.id;
      if (target !== entry.id) {
        if (fs.existsSync(this.dirOf(target))) {
          this.notes.push(`Kept "${entry.id}" (an account folder named "${target}" already exists).`);
        } else {
          fs.renameSync(entry.dir, this.dirOf(target));
          id = target;
        }
      }
      const meta = readJson(path.join(this.dirOf(id), 'meta.json')) || {};
      if (meta.alias !== undefined || meta.id !== id) {
        this.writeMeta(id, entry.identity, { created_at: meta.created_at });
      }
    }
    const state = this.getState();
    if (state.active_profile !== undefined) {
      const { active_profile, ...rest } = state;
      atomicWriteJson(this.statePath, rest);
    }
  }
}

module.exports = { AccountStore, sameAccount };
