/**
 * CraftSquad Tool - Multi-Engine Quota & Auth Monitor
 * Inspects Claude (~/.claude.json), ChatGPT/Codex (~/.codex/profiles), and Gemini/Antigravity status.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { execSync } = require('child_process');
const { listProfiles } = require('./codex-switcher-bridge');

function checkClaudeStatus() {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  let accountInfo = null;

  if (fs.existsSync(claudeJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
      accountInfo = data.oauthAccount || {};
    } catch (_) {}
  }

  let cliVersion = null;
  try {
    cliVersion = execSync('claude --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 }).trim();
  } catch (_) {}

  const isConnected = Boolean(accountInfo && accountInfo.emailAddress);
  const email = accountInfo ? accountInfo.emailAddress : 'Not logged in';
  const tier = accountInfo && accountInfo.billingType === 'stripe_subscription' ? 'Pro / Team Subscription' : (accountInfo && accountInfo.billingType) || 'Free / API Tier';

  return {
    engine: 'claude',
    name: 'Claude Code (Anthropic)',
    cliVersion: cliVersion || 'CLI Available',
    isConnected,
    account: email,
    tier,
    rateLimitTier: accountInfo ? (accountInfo.organizationRateLimitTier || 'Standard') : 'Unknown',
    orgName: accountInfo ? (accountInfo.organizationName || 'Default Org') : 'N/A',
    status: isConnected ? 'healthy' : 'warning',
    statusText: isConnected ? 'Connected & Subscribed' : 'Not Authenticated',
    color: '#d97706', // Amber / Anthropic gold
    stats: [
      { label: 'Account', value: email },
      { label: 'Plan', value: tier },
      { label: 'Rate Tier', value: accountInfo ? (accountInfo.organizationRateLimitTier || 'Default') : 'N/A' },
      { label: 'Role in Team', value: 'Architect & Developer' }
    ]
  };
}

function checkChatGPTStatus() {
  const profilesData = listProfiles();
  const activeAlias = profilesData.activeProfile;
  const activeProfile = profilesData.profiles.find((p) => p.alias === activeAlias) || profilesData.liveAuth;

  let cliVersion = null;
  try {
    cliVersion = execSync('codex --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 }).trim();
  } catch (_) {}

  const isExpired = activeProfile ? activeProfile.is_expired : true;
  const email = activeProfile ? activeProfile.email : 'Unknown';
  const timeLeft = activeProfile ? activeProfile.time_remaining_str : 'Unknown';
  const expiresAt = activeProfile ? activeProfile.expires_at_str : 'Unknown';
  const totalProfiles = profilesData.profiles.length;
  const validProfiles = profilesData.profiles.filter((p) => !p.is_expired).length;

  let status = 'healthy';
  let statusText = `Active (${timeLeft})`;
  if (isExpired) {
    status = 'error';
    statusText = 'Token Expired - Rotate Account';
  } else if (timeLeft.includes('h left') || timeLeft.includes('m left')) {
    status = 'warning';
    statusText = `Expiring soon (${timeLeft})`;
  }

  return {
    engine: 'codex',
    name: 'ChatGPT / OpenAI Codex',
    cliVersion: cliVersion || 'CLI Available',
    isConnected: Boolean(activeProfile && !activeProfile.error),
    account: email,
    activeAlias: activeAlias || 'Direct Auth',
    tier: 'ChatGPT Plus / Team Account',
    status,
    statusText,
    isExpired,
    timeLeft,
    expiresAt,
    percentRemaining: activeProfile ? (activeProfile.percent_remaining || 0) : 0,
    totalProfiles,
    validProfiles,
    color: '#10b981', // OpenAI Emerald
    stats: [
      { label: 'Active Profile', value: activeAlias || 'N/A' },
      { label: 'Email', value: email },
      { label: 'Token Expiry', value: timeLeft },
      { label: 'Standby Accounts', value: `${validProfiles}/${totalProfiles} Valid` }
    ]
  };
}

function checkGeminiStatus() {
  const lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:51787';

  return {
    engine: 'gemini',
    name: 'Google Gemini (Antigravity)',
    cliVersion: 'Antigravity Host Engine',
    isConnected: true,
    account: 'Antigravity Host Agent',
    tier: 'Gemini 3.8 Flash (High Reasoning Effort)',
    status: 'healthy',
    statusText: 'Active & Orchestrating',
    lsAddress,
    color: '#3b82f6', // Google Blue
    stats: [
      { label: 'Role in Team', value: 'Scrum Master, Spec Owner, Tester' },
      { label: 'Default Model', value: 'gemini-3.8-flash' },
      { label: 'Reasoning Effort', value: 'High' },
      { label: 'Delivery Mode', value: 'Dual-Track & Batch Delivery' }
    ]
  };
}

function getUnifiedQuotaStatus() {
  return {
    timestamp: new Date().toISOString(),
    claude: checkClaudeStatus(),
    chatgpt: checkChatGPTStatus(),
    gemini: checkGeminiStatus()
  };
}

module.exports = {
  getUnifiedQuotaStatus,
  checkClaudeStatus,
  checkChatGPTStatus,
  checkGeminiStatus
};
