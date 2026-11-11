/**
 * CraftSquad Tool - Built-in Codex Multi-Account Manager & Bi-Directional Token Sync Engine
 * Complete standalone port of chatgpt-codex-switcher.
 * Zero external dependencies (pure Node.js standard library).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

const CODEX_HOME = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), '.codex');

const PROFILES_DIR = path.join(CODEX_HOME, 'profiles');
const STATE_FILE = path.join(PROFILES_DIR, 'state.json');
const AUTH_FILE = path.join(CODEX_HOME, 'auth.json');

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

function ensureDirs() {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

function sanitizeAlias(alias) {
  const clean = String(alias || '').trim();
  if (!clean) throw new Error('Profile alias cannot be empty.');
  if (clean === '.' || clean === '..' || clean.startsWith('.') || clean.includes('..')) {
    throw new Error(`Invalid alias '${alias}'. Aliases cannot be '.', '..', start with '.', or contain '..'.`);
  }
  if (!/^[a-zA-Z0-9_\-\.@]+$/.test(clean)) {
    throw new Error(`Invalid alias '${alias}'. Only alphanumeric, '@', '-', '_', and '.' are allowed.`);
  }
  const baseName = clean.split(/[\.@]/)[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(clean.toUpperCase()) || WINDOWS_RESERVED_NAMES.has(baseName)) {
    throw new Error(`Invalid alias '${alias}'. Windows reserved device name '${clean}' is not allowed.`);
  }
  return clean;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return {};
  const parts = token.trim().split('.');
  if (parts.length < 2) return {};
  let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return {};
  }
}

function inspectAuthData(data) {
  if (!data || typeof data !== 'object') return {};
  const tokens = data.tokens || {};
  const idToken = tokens.id_token || '';
  const accessToken = tokens.access_token || '';

  const idPayload = decodeJwtPayload(idToken);
  const accessPayload = decodeJwtPayload(accessToken);

  const email = idPayload.email || accessPayload.email ||
    (accessPayload['https://api.openai.com/profile'] && accessPayload['https://api.openai.com/profile'].email) ||
    'Unknown';

  const name = idPayload.name || accessPayload.name ||
    (accessPayload['https://api.openai.com/profile'] && accessPayload['https://api.openai.com/profile'].name) ||
    'Unknown';

  const accountId = tokens.account_id ||
    (accessPayload['https://api.openai.com/auth'] && accessPayload['https://api.openai.com/auth'].account_id) ||
    idPayload.sub ||
    accessPayload.sub ||
    'Unknown';

  const exp = accessPayload.exp || idPayload.exp;
  const nowSec = Math.floor(Date.now() / 1000);

  let isExpired = false;
  let expiresAtStr = 'Unknown';
  let timeRemainingStr = 'Unknown';
  let percentRemaining = 0;

  if (exp && typeof exp === 'number') {
    expiresAtStr = new Date(exp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const diffSec = exp - nowSec;
    if (diffSec <= 0) {
      isExpired = true;
      timeRemainingStr = 'Expired';
      percentRemaining = 0;
    } else {
      const days = Math.floor(diffSec / 86400);
      const hours = Math.floor((diffSec % 86400) / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);

      if (days > 0) timeRemainingStr = `${days}d ${hours}h left`;
      else if (hours > 0) timeRemainingStr = `${hours}h ${mins}m left`;
      else timeRemainingStr = `${mins}m left`;

      // Token typically valid for 10 days
      percentRemaining = Math.min(100, Math.max(0, Math.round((diffSec / (10 * 86400)) * 100)));
    }
  }

  return {
    email,
    name,
    accountId,
    account_id: accountId,
    authMode: data.auth_mode || 'chatgpt',
    auth_mode: data.auth_mode || 'chatgpt',
    exp,
    isExpired,
    is_expired: isExpired,
    expiresAtStr,
    expires_at_str: expiresAtStr,
    timeRemainingStr,
    time_remaining_str: timeRemainingStr,
    percentRemaining,
    percent_remaining: percentRemaining,
    hasAccessToken: Boolean(tokens.access_token),
    has_access_token: Boolean(tokens.access_token),
    hasIdToken: Boolean(tokens.id_token),
    has_id_token: Boolean(tokens.id_token),
    hasRefreshToken: Boolean(tokens.refresh_token),
    has_refresh_token: Boolean(tokens.refresh_token),
    hasApiKey: Boolean(data.OPENAI_API_KEY),
    lastRefresh: data.last_refresh || null,
    last_refresh: data.last_refresh || null
  };
}

function inspectAuthFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      error: `File not found: ${filePath}`,
      email: 'None',
      name: 'None',
      accountId: 'None',
      account_id: 'None',
      isExpired: true,
      is_expired: true,
      expiresAtStr: 'N/A',
      expires_at_str: 'N/A',
      timeRemainingStr: 'N/A',
      time_remaining_str: 'N/A',
      percentRemaining: 0,
      percent_remaining: 0
    };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const inspected = inspectAuthData(data);
    inspected.filePath = String(filePath);
    return inspected;
  } catch (err) {
    return {
      error: `Failed to parse auth file: ${err.message}`,
      email: 'Error',
      name: 'Error',
      accountId: 'Error',
      account_id: 'Error',
      isExpired: true,
      is_expired: true,
      expiresAtStr: 'Error',
      expires_at_str: 'Error',
      timeRemainingStr: 'Error',
      time_remaining_str: 'Error',
      percentRemaining: 0,
      percent_remaining: 0
    };
  }
}

function atomicWriteJson(filePath, data, indent = 2) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `${path.basename(filePath)}.tmp.${process.pid}_${Date.now()}`);

  const content = JSON.stringify(data, null, indent) + '\n';
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Windows atomic replace fallback
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
  }
}

function atomicCopyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpDest = path.join(dir, `${path.basename(dest)}.tmp.${process.pid}_${Date.now()}`);

  fs.copyFileSync(src, tmpDest);
  try {
    fs.renameSync(tmpDest, dest);
  } catch (err) {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(tmpDest, dest);
  }
}

function findCodexBinary() {
  // 1. Check PATH
  try {
    const which = execSync(process.platform === 'win32' ? 'where codex' : 'which codex', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim().split(/\r?\n/)[0];
    if (which && fs.existsSync(which)) return which;
  } catch (_) {}

  // 2. Windows LocalAppData
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const binDir = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
      if (fs.existsSync(binDir)) {
        const subdirs = fs.readdirSync(binDir).sort().reverse();
        for (const sub of subdirs) {
          const candidate = path.join(binDir, sub, 'codex.exe');
          if (fs.existsSync(candidate)) return candidate;
        }
      }
      const direct = path.join(localAppData, 'OpenAI', 'Codex', 'codex.exe');
      if (fs.existsSync(direct)) return direct;
    }
  }

  return 'codex';
}

function restartDaemon(timeout = 15) {
  const bin = findCodexBinary();
  try {
    const out = execSync(`"${bin}" app-server daemon restart`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: timeout * 1000
    });
    return { success: true, message: out.trim() || 'Daemon restarted successfully.' };
  } catch (err) {
    return { success: false, message: `Daemon restart failed or not running: ${err.message}` };
  }
}

class CodexManager {
  constructor(customCodexHome) {
    this.codexHome = customCodexHome ? path.resolve(customCodexHome) : CODEX_HOME;
    this.authFile = path.join(this.codexHome, 'auth.json');
    this.profilesDir = path.join(this.codexHome, 'profiles');
    this.stateFile = path.join(this.profilesDir, 'state.json');
    ensureDirs();
  }

  getState() {
    if (fs.existsSync(this.stateFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      } catch (_) {}
    }
    return { active_profile: null, last_switched_at: null };
  }

  saveState(state) {
    atomicWriteJson(this.stateFile, state);
  }

  listProfiles() {
    const state = this.getState();
    const activeAlias = state.active_profile;
    const profiles = [];

    if (fs.existsSync(this.profilesDir)) {
      const entries = fs.readdirSync(this.profilesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const alias = entry.name;
        const pAuth = path.join(this.profilesDir, alias, 'auth.json');
        if (!fs.existsSync(pAuth)) continue;

        let metaData = {};
        const metaFile = path.join(this.profilesDir, alias, 'meta.json');
        if (fs.existsSync(metaFile)) {
          try {
            metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
          } catch (_) {}
        }

        const authInfo = inspectAuthFile(pAuth);
        const email = authInfo.email !== 'Unknown' ? authInfo.email : (metaData.email || 'Unknown');
        const name = authInfo.name !== 'Unknown' ? authInfo.name : (metaData.name || 'Unknown');
        const accountId = authInfo.accountId !== 'Unknown' ? authInfo.accountId : (metaData.account_id || 'Unknown');

        profiles.push({
          alias,
          email,
          name,
          accountId,
          account_id: accountId,
          authMode: authInfo.authMode || 'chatgpt',
          auth_mode: authInfo.authMode || 'chatgpt',
          exp: authInfo.exp,
          isExpired: authInfo.isExpired,
          is_expired: authInfo.isExpired,
          expiresAtStr: authInfo.expiresAtStr,
          expires_at_str: authInfo.expiresAtStr,
          timeRemainingStr: authInfo.timeRemainingStr,
          time_remaining_str: authInfo.timeRemainingStr,
          percentRemaining: authInfo.percentRemaining,
          percent_remaining: authInfo.percentRemaining,
          isActive: alias === activeAlias,
          is_active: alias === activeAlias,
          createdAt: metaData.created_at || null,
          updatedAt: metaData.updated_at || null
        });
      }
    }

    profiles.sort((a, b) => {
      if (a.isActive) return -1;
      if (b.isActive) return 1;
      if (a.isExpired && !b.isExpired) return 1;
      if (!a.isExpired && b.isExpired) return -1;
      return a.alias.localeCompare(b.alias);
    });

    profiles.forEach((p, idx) => { p.index = idx + 1; });

    const liveAuth = inspectAuthFile(this.authFile);

    return {
      success: true,
      activeProfile: activeAlias,
      liveAuth,
      profiles,
      profilesDir: this.profilesDir,
      totalCount: profiles.length,
      validCount: profiles.filter((p) => !p.isExpired).length
    };
  }

  resolveAlias(aliasOrIdx) {
    const { profiles } = this.listProfiles();
    if (!profiles.length) throw new Error("No profiles saved yet. Use 'save' to add one.");

    const target = String(aliasOrIdx).trim();
    if (/^\d+$/.test(target)) {
      const idx = parseInt(target, 10);
      const match = profiles.find((p) => p.index === idx);
      if (match) return match.alias;
      throw new Error(`Invalid profile index ${idx}. Available: 1 to ${profiles.length}.`);
    }

    const exact = profiles.find((p) => p.alias === target);
    if (exact) return exact.alias;

    const caseInsensitive = profiles.find((p) => p.alias.toLowerCase() === target.toLowerCase());
    if (caseInsensitive) return caseInsensitive.alias;

    throw new Error(`Profile '${target}' not found. Available: ${profiles.map((p) => p.alias).join(', ')}`);
  }

  /**
   * Bi-directional Token Sync (Sync-on-switch):
   * Copies daemon-refreshed tokens from ~/.codex/auth.json back to active profile folder.
   */
  syncCurrentAuthToProfile() {
    if (!fs.existsSync(this.authFile)) return null;

    const currentAuthInfo = inspectAuthFile(this.authFile);
    const currentEmail = currentAuthInfo.email;
    const currentAccount = currentAuthInfo.accountId;

    const state = this.getState();
    const activeAlias = state.active_profile;

    let targetAlias = null;

    // Match by active_profile
    if (activeAlias) {
      const pDir = path.join(this.profilesDir, activeAlias);
      if (fs.existsSync(pDir) && fs.existsSync(path.join(pDir, 'auth.json'))) {
        targetAlias = activeAlias;
      }
    }

    // Fallback: match by email or accountId
    if (!targetAlias && (currentEmail !== 'Unknown' || currentAccount !== 'Unknown')) {
      const { profiles } = this.listProfiles();
      for (const p of profiles) {
        if (currentEmail !== 'Unknown' && p.email === currentEmail) {
          targetAlias = p.alias;
          break;
        }
        if (currentAccount !== 'Unknown' && p.accountId === currentAccount) {
          targetAlias = p.alias;
          break;
        }
      }
    }

    if (!targetAlias) return null;

    const destDir = path.join(this.profilesDir, targetAlias);
    const destAuth = path.join(destDir, 'auth.json');

    atomicCopyFile(this.authFile, destAuth);

    const metaFile = path.join(destDir, 'meta.json');
    let meta = {};
    if (fs.existsSync(metaFile)) {
      try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch (_) {}
    }
    meta.email = currentEmail;
    meta.account_id = currentAccount;
    meta.name = currentAuthInfo.name;
    meta.updated_at = new Date().toISOString();
    atomicWriteJson(metaFile, meta);

    return targetAlias;
  }

  switchProfile(aliasOrIdx, options = {}) {
    const alias = this.resolveAlias(aliasOrIdx);
    const profileDir = path.join(this.profilesDir, alias);
    const profileAuth = path.join(profileDir, 'auth.json');

    if (!fs.existsSync(profileAuth)) {
      throw new Error(`Profile '${alias}' auth file missing at: ${profileAuth}`);
    }

    // 1. Bi-directional sync current auth back to active profile
    const syncedAlias = this.syncCurrentAuthToProfile();

    // 2. Atomically copy target profile into active auth.json
    atomicCopyFile(profileAuth, this.authFile);

    // 3. Update active state
    this.saveState({
      active_profile: alias,
      last_switched_at: new Date().toISOString()
    });

    // 4. Restart background daemon if requested
    let daemonResult = null;
    if (options.restartDaemon !== false) {
      daemonResult = restartDaemon();
    }

    const live = inspectAuthFile(this.authFile);

    return {
      success: true,
      activeProfile: alias,
      syncedProfile: syncedAlias,
      email: live.email,
      timeLeft: live.timeRemainingStr,
      daemon: daemonResult
    };
  }

  saveCurrentAsProfile(alias) {
    const safeAlias = sanitizeAlias(alias);
    if (!fs.existsSync(this.authFile)) {
      throw new Error(`No active auth file found at: ${this.authFile}`);
    }

    const currentInfo = inspectAuthFile(this.authFile);
    const profileDir = path.join(this.profilesDir, safeAlias);
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    const destAuth = path.join(profileDir, 'auth.json');
    atomicCopyFile(this.authFile, destAuth);

    const metaFile = path.join(profileDir, 'meta.json');
    const now = new Date().toISOString();
    const meta = {
      alias: safeAlias,
      email: currentInfo.email,
      name: currentInfo.name,
      account_id: currentInfo.accountId,
      created_at: now,
      updated_at: now
    };
    atomicWriteJson(metaFile, meta);

    this.saveState({
      active_profile: safeAlias,
      last_switched_at: now
    });

    return {
      success: true,
      alias: safeAlias,
      email: currentInfo.email,
      timeLeft: currentInfo.timeRemainingStr
    };
  }

  removeProfile(aliasOrIdx) {
    const alias = this.resolveAlias(aliasOrIdx);
    const profileDir = path.join(this.profilesDir, alias);

    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }

    const state = this.getState();
    if (state.active_profile === alias) {
      this.saveState({
        active_profile: null,
        last_switched_at: new Date().toISOString()
      });
    }

    return { success: true, removed: alias };
  }

  rotateNext(options = {}) {
    const { profiles, activeProfile } = this.listProfiles();
    if (!profiles.length) throw new Error('No profiles found in ~/.codex/profiles/');

    const validProfiles = profiles.filter((p) => !p.isExpired);
    const pool = validProfiles.length ? validProfiles : profiles;

    const currentIndex = pool.findIndex((p) => p.alias === activeProfile);
    const nextIndex = (currentIndex + 1) % pool.length;
    const nextProfile = pool[nextIndex];

    return this.switchProfile(nextProfile.alias, options);
  }

  doctor() {
    const bin = findCodexBinary();
    let version = null;
    try {
      version = execSync(`"${bin}" --version`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 }).trim();
    } catch (_) {}

    const authExists = fs.existsSync(this.authFile);
    const authInfo = inspectAuthFile(this.authFile);
    const state = this.getState();
    const { profiles, validCount } = this.listProfiles();

    return {
      codexBinary: bin,
      codexVersion: version || 'Not installed',
      codexHome: this.codexHome,
      authFileExists: authExists,
      activeProfile: state.active_profile || 'None',
      currentEmail: authInfo.email,
      tokenStatus: authInfo.timeRemainingStr,
      totalProfiles: profiles.length,
      validProfiles: validCount,
      profilesDir: this.profilesDir
    };
  }
}

// Default singleton instance
const codexManager = new CodexManager();

module.exports = {
  CodexManager,
  codexManager,
  inspectAuthData,
  inspectAuthFile,
  decodeJwtPayload,
  sanitizeAlias,
  findCodexBinary,
  restartDaemon
};
