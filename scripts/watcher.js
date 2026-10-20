#!/usr/bin/env node

/**
 * CraftSquad File Watcher
 * Automatically monitors handoff files in .agents/ (including recursive multi-feature subdirectories)
 * and detects when Codex or PM updates specifications.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const agentsDir = path.join(process.cwd(), '.agents');
const stateFile = path.join(agentsDir, 'STATE.json');

if (!fs.existsSync(agentsDir)) {
  console.error('❌ .agents/ directory not found. Run `npx craft-squad init` first.');
  process.exit(1);
}

function loadState(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveState(filePath, state) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save state file:', filePath, e.message);
  }
}

function sendPushNotification(message, channel) {
  if (!channel) return;
  const postData = message;
  const req = https.request(
    `https://ntfy.sh/${channel}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Title': 'CraftSquad Alert'
      }
    },
    (res) => {}
  );
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

console.log('👀 CraftSquad Watcher is listening to .agents/...');
console.log('💡 Supports recursive multi-feature detection for Web & Mobile.');

let debounceTimeout = null;

try {
  fs.watch(agentsDir, { recursive: true }, (eventType, rawFilename) => {
    if (!rawFilename) return;

    const normalizedPath = rawFilename.replace(/\\/g, '/');
    const baseName = path.basename(normalizedPath);

    if (baseName !== '02_UI_SPEC.md' && baseName !== '01_PRD.md') return;

    if (debounceTimeout) clearTimeout(debounceTimeout);

    debounceTimeout = setTimeout(() => {
      const fullPath = path.join(agentsDir, normalizedPath);
      if (!fs.existsSync(fullPath)) return;

      const stats = fs.statSync(fullPath);
      if (stats.size < 50) return;

      let slug = 'default';
      const parts = normalizedPath.split('/');
      if (parts[0] === 'features' && parts.length >= 3) {
        slug = parts[1];
      }

      const rootState = loadState(stateFile);
      const notifyChannel = rootState.notification_channel || '';
      const nowIso = new Date().toISOString();

      if (baseName === '02_UI_SPEC.md') {
        if (!rootState.active_features) rootState.active_features = {};
        if (!rootState.active_features[slug]) rootState.active_features[slug] = {};
        rootState.active_features[slug].phase = 'AWAITING_DEV';
        rootState.active_features[slug].last_actor = 'codex_astra';
        rootState.active_features[slug].updated_at = nowIso;
        saveState(stateFile, rootState);

        const featureStatePath = path.join(agentsDir, 'features', slug, 'STATE.json');
        if (fs.existsSync(path.dirname(featureStatePath))) {
          const featState = loadState(featureStatePath);
          featState.phase = 'AWAITING_DEV';
          featState.last_actor = 'codex_astra';
          featState.updated_at = nowIso;
          saveState(featureStatePath, featState);
        }

        console.log(`\n⚡ [WATCHER]: Detected UI Spec update for [${slug}] by Codex!`);
        console.log('👉 Transitioned phase to: AWAITING_DEV');
        sendPushNotification(`Codex updated UI Spec for [${slug}]. Antigravity can start development.`, notifyChannel);

      } else if (baseName === '01_PRD.md') {
        if (!rootState.active_features) rootState.active_features = {};
        if (!rootState.active_features[slug]) rootState.active_features[slug] = {};
        rootState.active_features[slug].phase = 'AWAITING_ASTRA';
        rootState.active_features[slug].last_actor = 'antigravity_pm';
        rootState.active_features[slug].updated_at = nowIso;
        saveState(stateFile, rootState);

        const featureStatePath = path.join(agentsDir, 'features', slug, 'STATE.json');
        if (fs.existsSync(path.dirname(featureStatePath))) {
          const featState = loadState(featureStatePath);
          featState.phase = 'AWAITING_ASTRA';
          featState.last_actor = 'antigravity_pm';
          featState.updated_at = nowIso;
          saveState(featureStatePath, featState);
        }

        console.log(`\n⚡ [WATCHER]: Detected PRD update for [${slug}] by PM!`);
        console.log('👉 Transitioned phase to: AWAITING_ASTRA');
        sendPushNotification(`PM updated PRD for [${slug}]. Open Codex to design UI / plan architecture.`, notifyChannel);
      }
    }, 500);
  });
} catch (err) {
  console.error('Watcher initialization error:', err.message);
}
