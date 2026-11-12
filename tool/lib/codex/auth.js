/**
 * CraftSquad Tool - Codex auth.json inspection. Reads identity from the JWT claims; never returns token values.
 */

const fs = require('fs');
const { formatTimeLeft } = require('../fs-utils');

const AUTH_CLAIM = 'https://api.openai.com/auth';
const PROFILE_CLAIM = 'https://api.openai.com/profile';

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return {};
  const parts = token.trim().split('.');
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch (_) {
    return {};
  }
}

/**
 * Identity and health of an auth.json payload. Returns null when it holds no ChatGPT account
 * (empty file, API-key login, unreadable tokens).
 */
function inspectAuthData(data) {
  if (!data || typeof data !== 'object') return null;
  const tokens = data.tokens || {};
  const id = decodeJwtPayload(tokens.id_token);
  const access = decodeJwtPayload(tokens.access_token);
  const authClaim = id[AUTH_CLAIM] || access[AUTH_CLAIM] || {};
  const profileClaim = access[PROFILE_CLAIM] || {};

  const email = id.email || access.email || profileClaim.email || null;
  if (!email) return null;

  const exp = access.exp || id.exp || null;
  const diff = exp ? exp - Math.floor(Date.now() / 1000) : null;
  return {
    email,
    name: id.name || access.name || profileClaim.name || null,
    accountId: tokens.account_id || authClaim.chatgpt_account_id || null,
    plan: authClaim.chatgpt_plan_type || null,
    authMode: data.auth_mode || 'chatgpt',
    hasRefreshToken: Boolean(tokens.refresh_token),
    accessExpiresAt: exp ? new Date(exp * 1000).toISOString() : null,
    accessTimeLeft: diff === null ? null : formatTimeLeft(diff),
    accessExpired: diff !== null && diff <= 0,
    lastRefresh: data.last_refresh || null
  };
}

function readAuthIdentity(file) {
  try {
    return inspectAuthData(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (_) {
    return null;
  }
}

module.exports = { decodeJwtPayload, inspectAuthData, readAuthIdentity };
