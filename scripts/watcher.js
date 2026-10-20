#!/usr/bin/env node

/**
 * CraftXTech Agent File Watcher
 * Tự động theo dõi các file Handoff trong .agents/
 * và phát hiện khi Astra hoặc PM vừa hoàn thành nhiệm vụ.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const agentsDir = path.join(process.cwd(), '.agents');
const stateFile = path.join(agentsDir, 'STATE.json');

if (!fs.existsSync(agentsDir)) {
  console.error('❌ Không tìm thấy thư mục .agents/. Hãy chạy `npx craftxtech-agent init` trước.');
  process.exit(1);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    return { phase: 'IDLE' };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Lỗi khi lưu STATE.json:', e.message);
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
        'Title': 'CraftXTech Agent Alert'
      }
    },
    (res) => {}
  );
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

console.log('👀 CraftXTech Watcher đang lắng nghe thư mục .agents/...');
console.log('💡 Khi Codex Astra lưu 02_UI_SPEC.md hoặc PM lưu 01_PRD.md, trạng thái sẽ tự động cập nhật.');

let debounceTimeout = null;

fs.watch(agentsDir, (eventType, filename) => {
  if (!filename) return;

  if (debounceTimeout) clearTimeout(debounceTimeout);

  debounceTimeout = setTimeout(() => {
    const state = loadState();
    const notifyChannel = state.notification_channel || '';

    if (filename === '02_UI_SPEC.md') {
      const stats = fs.statSync(path.join(agentsDir, '02_UI_SPEC.md'));
      if (stats.size > 50) {
        state.phase = 'AWAITING_DEV';
        state.last_actor = 'codex_astra';
        state.updated_at = new Date().toISOString();
        saveState(state);

        console.log('\n⚡ [WATCHER]: Phát hiện Astra vừa cập nhật 02_UI_SPEC.md!');
        console.log('👉 Trạng thái chuyển thành: AWAITING_DEV');
        sendPushNotification('Astra đã cập nhật UI Spec! Antigravity có thể triển khai code ngay.', notifyChannel);
      }
    } else if (filename === '01_PRD.md') {
      const stats = fs.statSync(path.join(agentsDir, '01_PRD.md'));
      if (stats.size > 50) {
        state.phase = 'AWAITING_ASTRA';
        state.last_actor = 'antigravity_pm';
        state.updated_at = new Date().toISOString();
        saveState(state);

        console.log('\n⚡ [WATCHER]: Phát hiện PM vừa cập nhật 01_PRD.md!');
        console.log('👉 Trạng thái chuyển thành: AWAITING_ASTRA');
        sendPushNotification('PM đã cập nhật PRD! Mở Codex để Astra lên UI Plan.', notifyChannel);
      }
    }
  }, 500);
});
