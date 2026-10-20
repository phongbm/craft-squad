#!/usr/bin/env node

/**
 * CraftSquad File Watcher
 * Automatically monitors handoff files in .agents/ (including recursive multi-feature subdirectories)
 * and detects when Codex or PM updates specifications or task plans.
 */

const fs = require('fs');
const path = require('path');

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

console.log('👀 CraftSquad Watcher is listening to .agents/...');
console.log('💡 Pure local execution: zero external network dependencies.');

let debounceTimeout = null;

try {
  fs.watch(agentsDir, { recursive: true }, (eventType, rawFilename) => {
    if (!rawFilename) return;

    const normalizedPath = rawFilename.replace(/\\/g, '/');
    const baseName = path.basename(normalizedPath);

    if (baseName !== '02_UI_SPEC.md' && baseName !== '01_PRD.md' && baseName !== '03_TASKS.md') return;

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
      const nowIso = new Date().toISOString();

      if (baseName === '02_UI_SPEC.md' || baseName === '03_TASKS.md') {
        if (!rootState.active_features) rootState.active_features = {};
        if (!rootState.active_features[slug]) rootState.active_features[slug] = {};
        rootState.active_features[slug].phase = 'AWAITING_DEV';
        rootState.active_features[slug].last_actor = baseName === '02_UI_SPEC.md' ? 'codex_astra' : 'codex_planner';
        rootState.active_features[slug].updated_at = nowIso;
        saveState(stateFile, rootState);

        const featureStatePath = path.join(agentsDir, 'features', slug, 'STATE.json');
        if (fs.existsSync(path.dirname(featureStatePath))) {
          const featState = loadState(featureStatePath);
          featState.phase = 'AWAITING_DEV';
          featState.last_actor = rootState.active_features[slug].last_actor;
          featState.updated_at = nowIso;
          saveState(featureStatePath, featState);
        }

        console.log(`\n⚡ [WATCHER]: Detected ${baseName} update for [${slug}]!`);
        console.log('👉 Transitioned phase to: AWAITING_DEV');

      } else if (baseName === '01_PRD.md') {
        if (!rootState.active_features) rootState.active_features = {};
        if (!rootState.active_features[slug]) rootState.active_features[slug] = {};
        rootState.active_features[slug].phase = 'AWAITING_PLAN';
        rootState.active_features[slug].last_actor = 'antigravity_pm';
        rootState.active_features[slug].updated_at = nowIso;
        saveState(stateFile, rootState);

        const featureStatePath = path.join(agentsDir, 'features', slug, 'STATE.json');
        if (fs.existsSync(path.dirname(featureStatePath))) {
          const featState = loadState(featureStatePath);
          featState.phase = 'AWAITING_PLAN';
          featState.last_actor = 'antigravity_pm';
          featState.updated_at = nowIso;
          saveState(featureStatePath, featState);
        }

        console.log(`\n⚡ [WATCHER]: Detected PRD update for [${slug}] by PM!`);
        console.log('👉 Transitioned phase to: AWAITING_PLAN');
      }
    }, 500);
  });
} catch (err) {
  console.error('Watcher initialization error:', err.message);
}
