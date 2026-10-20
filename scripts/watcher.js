#!/usr/bin/env node

/**
 * CraftSquad File Watcher
 * Tự động theo dõi các file Handoff trong .agents/ (hỗ trợ cả multi-feature subdirectories)
 * và phát hiện khi Astra hoặc PM vừa hoàn thành nhiệm vụ.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const agentsDir = path.join(process.cwd(), '.agents');
const stateFile = path.join(agentsDir, 'STATE.json');

if (!fs.existsSync(agentsDir)) {
  console.error('❌ Không tìm thấy thư mục .agents/. Hãy chạy `npx craft-squad init` trước.');
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
    console.error('Lỗi khi lưu state file:', filePath, e.message);
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

console.log('👀 CraftSquad Watcher đang lắng nghe thư mục .agents/...');
console.log('💡 Hỗ trợ tự động nhận diện cả thư mục features/<slug>/ đa tính năng (Web & Mobile).');

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

        console.log(`\n⚡ [WATCHER]: Phát hiện Astra vừa cập nhật UI Spec cho [${slug}]!`);
        console.log('👉 Trạng thái chuyển thành: AWAITING_DEV');
        sendPushNotification(`Astra đã lên UI Spec cho [${slug}]! Antigravity có thể triển khai code ngay.`, notifyChannel);

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

        console.log(`\n⚡ [WATCHER]: Phát hiện PM vừa cập nhật PRD cho [${slug}]!`);
        console.log('👉 Trạng thái chuyển thành: AWAITING_ASTRA');
        sendPushNotification(`PM đã cập nhật PRD cho [${slug}]! Mở Codex để Astra lên UI Plan.`, notifyChannel);
      }
    }, 500);
  });
} catch (err) {
  console.error('Lỗi khởi động Watcher:', err.message);
}
