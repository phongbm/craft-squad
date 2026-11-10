/**
 * CraftSquad Tool - ChatGPT Codex Switcher Bridge
 * Integrates directly with chatgpt-codex-switcher repo and ~/.codex/profiles/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CODEX_SWITCHER_DIR = 'D:\\Projects\\MyBusiness\\chatgpt-codex-switcher';
const CODEX_HOME = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), '.codex');
const PROFILES_DIR = path.join(CODEX_HOME, 'profiles');
const STATE_FILE = path.join(PROFILES_DIR, 'state.json');
const AUTH_FILE = path.join(CODEX_HOME, 'auth.json');

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

function inspectAuthFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found', email: 'N/A', is_expired: true, time_remaining_str: 'N/A' };
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const tokens = data.tokens || {};
    const idPayload = decodeJwtPayload(tokens.id_token || '');
    const accessPayload = decodeJwtPayload(tokens.access_token || '');

    const email = idPayload.email || accessPayload.email ||
      (accessPayload['https://api.openai.com/profile'] && accessPayload['https://api.openai.com/profile'].email) ||
      'Unknown';
    const name = idPayload.name || accessPayload.name || 'Unknown';
    const exp = accessPayload.exp || idPayload.exp;
    const nowSec = Math.floor(Date.now() / 1000);

    let is_expired = false;
    let expires_at_str = 'Unknown';
    let time_remaining_str = 'Unknown';
    let percent_remaining = 0;

    if (exp) {
      const expSec = Number(exp);
      expires_at_str = new Date(expSec * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      const diffSec = expSec - nowSec;
      if (diffSec <= 0) {
        is_expired = true;
        time_remaining_str = 'Expired';
        percent_remaining = 0;
      } else {
        const days = Math.floor(diffSec / 86400);
        const hours = Math.floor((diffSec % 86400) / 3600);
        const mins = Math.floor((diffSec % 3600) / 60);
        if (days > 0) time_remaining_str = `${days}d ${hours}h left`;
        else if (hours > 0) time_remaining_str = `${hours}h ${mins}m left`;
        else time_remaining_str = `${mins}m left`;

        // Estimate percentage: access tokens usually last ~10 days (864000s)
        percent_remaining = Math.min(100, Math.max(0, Math.round((diffSec / (10 * 86400)) * 100)));
      }
    }

    return {
      email,
      name,
      exp,
      is_expired,
      expires_at_str,
      time_remaining_str,
      percent_remaining,
      auth_mode: data.auth_mode || 'chatgpt',
      has_access_token: Boolean(tokens.access_token),
      has_refresh_token: Boolean(tokens.refresh_token)
    };
  } catch (err) {
    return { error: err.message, email: 'Error', is_expired: true, time_remaining_str: 'Error' };
  }
}

function getSwitcherState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (_) {}
  }
  return { active_profile: null, last_switched_at: null };
}

function listProfiles() {
  const state = getSwitcherState();
  const activeAlias = state.active_profile;
  const profiles = [];

  if (fs.existsSync(PROFILES_DIR)) {
    const entries = fs.readdirSync(PROFILES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const alias = entry.name;
      const profileAuth = path.join(PROFILES_DIR, alias, 'auth.json');
      if (!fs.existsSync(profileAuth)) continue;

      const inspected = inspectAuthFile(profileAuth);
      profiles.push({
        alias,
        isActive: alias === activeAlias,
        ...inspected
      });
    }
  }

  // Sort: active first, then non-expired, then alias name
  profiles.sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    if (a.is_expired && !b.is_expired) return 1;
    if (!a.is_expired && b.is_expired) return -1;
    return a.alias.localeCompare(b.alias);
  });

  // Current live auth inspection
  const liveAuth = inspectAuthFile(AUTH_FILE);

  return {
    success: true,
    activeProfile: activeAlias,
    liveAuth,
    profiles,
    switcherRepo: CODEX_SWITCHER_DIR,
    profilesDir: PROFILES_DIR
  };
}

function switchProfile(targetAlias) {
  if (!targetAlias) throw new Error('Target profile alias is required');

  const cxCmd = path.join(CODEX_SWITCHER_DIR, 'bin', 'cx.cmd');
  if (fs.existsSync(cxCmd)) {
    try {
      const out = execSync(`"${cxCmd}" switch "${targetAlias}"`, {
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true
      });
      return { success: true, message: out.trim(), active_profile: targetAlias };
    } catch (err) {
      // Fallback to internal swap if CLI execution had issues
    }
  }

  // Fallback: internal direct swap
  const targetDir = path.join(PROFILES_DIR, targetAlias);
  const targetAuth = path.join(targetDir, 'auth.json');
  if (!fs.existsSync(targetAuth)) {
    throw new Error(`Profile "${targetAlias}" not found at ${targetDir}`);
  }

  fs.copyFileSync(targetAuth, AUTH_FILE);
  const state = {
    active_profile: targetAlias,
    last_switched_at: new Date().toISOString()
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  return {
    success: true,
    message: `Switched to ${targetAlias} (direct copy)`,
    active_profile: targetAlias
  };
}

function rotateNextProfile() {
  const { profiles, activeProfile } = listProfiles();
  if (!profiles.length) throw new Error('No profiles found in ~/.codex/profiles/');

  // Find non-expired profiles
  const validProfiles = profiles.filter((p) => !p.is_expired);
  const pool = validProfiles.length ? validProfiles : profiles;

  const currentIndex = pool.findIndex((p) => p.alias === activeProfile);
  const nextIndex = (currentIndex + 1) % pool.length;
  const nextProfile = pool[nextIndex];

  return switchProfile(nextProfile.alias);
}

module.exports = {
  CODEX_SWITCHER_DIR,
  PROFILES_DIR,
  listProfiles,
  switchProfile,
  rotateNextProfile,
  inspectAuthFile
};
