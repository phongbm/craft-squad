// CraftSquad Studio - Frontend Application

const API_BASE = '';

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.borderColor = isError ? '#ef4444' : '#10b981';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// --------------------------------------------------------------------------
// 1. Quotas & Multi-Engine Auth Monitor
// --------------------------------------------------------------------------
async function loadQuotas() {
  const container = document.getElementById('quota-cards');
  try {
    const res = await fetch(`${API_BASE}/api/quota`);
    const data = await res.json();

    const engines = [data.claude, data.chatgpt, data.gemini].filter(Boolean);
    container.innerHTML = engines.map(eng => {
      let progressBar = '';
      if (eng.percentRemaining !== undefined) {
        progressBar = `
          <div class="progress-bar-container">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${eng.percentRemaining}%; background: ${eng.color}"></div>
            </div>
          </div>
        `;
      }

      const rows = (eng.stats || []).map(s => `
        <div class="quota-row">
          <span class="quota-label">${s.label}</span>
          <span class="quota-val">${s.value}</span>
        </div>
      `).join('');

      return `
        <div class="card quota-card" style="border-left: 3px solid ${eng.color}">
          <div class="quota-header">
            <div class="engine-title">
              <span class="engine-pill" style="background: ${eng.color}"></span>
              ${eng.name}
            </div>
            <span class="status-badge ${eng.status}">
              <span class="dot"></span> ${eng.statusText}
            </span>
          </div>
          <div class="quota-body">
            ${rows}
            ${progressBar}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="card text-danger">Failed to load quotas: ${err.message}</div>`;
  }
}

// --------------------------------------------------------------------------
// 2. ChatGPT Codex Account Rotator & Native Switcher
// --------------------------------------------------------------------------
async function loadCodexProfiles() {
  const tbody = document.getElementById('profiles-tbody');
  const activeName = document.getElementById('active-profile-name');
  const activeToken = document.getElementById('active-profile-token');

  try {
    const res = await fetch(`${API_BASE}/api/codex/profiles`);
    const data = await res.json();
    const profiles = data.profiles || [];
    const liveAuth = data.liveAuth || {};

    if (activeName) activeName.textContent = data.activeProfile || 'None (Direct Auth)';
    if (activeToken) activeToken.textContent = liveAuth.timeRemainingStr || liveAuth.time_remaining_str || 'N/A';

    if (!profiles.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px; color: var(--text-dim)">No profiles found in ~/.codex/profiles/. Save your current login above!</td></tr>`;
      return;
    }

    tbody.innerHTML = profiles.map((p, idx) => {
      const isAct = p.isActive;
      const isExp = p.isExpired || p.is_expired;
      const timeLeft = p.timeRemainingStr || p.time_remaining_str || 'Unknown';
      const statusBadge = isExp
        ? `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">EXPIRED</span>`
        : `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">${timeLeft}</span>`;

      const activeBadge = isAct
        ? `<span class="badge badge-info">ACTIVE</span>`
        : `<span style="color: var(--text-dim)">Standby</span>`;

      const switchBtn = isAct
        ? `<button class="btn btn-sm btn-secondary" disabled>Current</button>`
        : `<button class="btn btn-sm btn-primary" onclick="handleSwitchProfile('${p.alias}')">Switch</button>`;

      const deleteBtn = isAct
        ? ''
        : `<button class="btn btn-sm btn-icon" title="Remove Profile" onclick="handleRemoveProfile('${p.alias}')">🗑️</button>`;

      return `
        <tr class="${isAct ? 'active-row' : ''}">
          <td style="color: var(--text-dim); font-family: var(--font-mono); font-size: 12px;">${p.index || (idx + 1)}</td>
          <td>
            <div class="profile-alias">
              ${isAct ? '⚡' : '👤'} ${p.alias}
            </div>
          </td>
          <td>${p.email}</td>
          <td><code>${p.auth_mode || p.authMode || 'chatgpt'}</code></td>
          <td>${statusBadge}</td>
          <td>${activeBadge}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              ${switchBtn}
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Failed to load profiles: ${err.message}</td></tr>`;
  }
}

async function handleSwitchProfile(alias) {
  try {
    const res = await fetch(`${API_BASE}/api/codex/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Switched active Codex profile to: ${alias}`);
      await Promise.all([loadCodexProfiles(), loadQuotas()]);
    } else {
      showToast(`Switch failed: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

async function handleRotateNext() {
  try {
    const res = await fetch(`${API_BASE}/api/codex/rotate`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Rotated to profile: ${data.activeProfile || data.active_profile}`);
      await Promise.all([loadCodexProfiles(), loadQuotas()]);
    } else {
      showToast(`Rotation failed: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

async function handleSaveCurrentProfile() {
  const input = document.getElementById('save-alias-input');
  const alias = input.value.trim();
  if (!alias) {
    showToast('Please enter a profile alias (e.g. personal, work)', true);
    input.focus();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/codex/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Saved current auth as profile: [${data.alias}]`);
      input.value = '';
      await Promise.all([loadCodexProfiles(), loadQuotas()]);
    } else {
      showToast(`Save failed: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

async function handleRemoveProfile(alias) {
  if (!confirm(`Are you sure you want to remove profile '${alias}'?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/codex/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Removed profile: ${alias}`);
      await Promise.all([loadCodexProfiles(), loadQuotas()]);
    } else {
      showToast(`Remove failed: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

async function handleSyncTokens() {
  try {
    const res = await fetch(`${API_BASE}/api/codex/sync`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Synced tokens successfully');
      await Promise.all([loadCodexProfiles(), loadQuotas()]);
    } else {
      showToast(`Sync failed: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

async function handleDoctor() {
  const modal = document.getElementById('doctor-modal');
  const content = document.getElementById('doctor-content');
  modal.classList.add('show');
  content.innerHTML = '<div class="doctor-row">Running diagnostics...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/codex/doctor`);
    const data = await res.json();
    const doc = data.doctor || {};

    const items = [
      { label: 'Codex Executable', value: doc.codexBinary },
      { label: 'CLI Version', value: doc.codexVersion },
      { label: 'Codex Home Dir', value: doc.codexHome },
      { label: 'Auth File Exists', value: doc.authFileExists ? 'Yes (~/.codex/auth.json)' : 'Missing' },
      { label: 'Active Profile', value: doc.activeProfile },
      { label: 'Current Account', value: doc.currentEmail },
      { label: 'Token Remaining', value: doc.tokenStatus },
      { label: 'Profile Pool', value: `${doc.validProfiles}/${doc.totalProfiles} Valid Accounts` }
    ];

    content.innerHTML = items.map(item => `
      <div class="doctor-row">
        <span class="doctor-label">${item.label}</span>
        <span class="doctor-value">${item.value || 'N/A'}</span>
      </div>
    `).join('');
  } catch (err) {
    content.innerHTML = `<div class="doctor-row text-danger">Doctor failed: ${err.message}</div>`;
  }
}

async function handleRestartDaemon() {
  try {
    const res = await fetch(`${API_BASE}/api/codex/restart-daemon`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Codex background daemon restarted');
      handleDoctor();
    } else {
      showToast(`Restart failed: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

function closeDoctorModal() {
  const modal = document.getElementById('doctor-modal');
  modal.classList.remove('show');
}

// --------------------------------------------------------------------------
// 3. Role & Model Switcher (squad.config.json)
// --------------------------------------------------------------------------
let globalConfig = null;
let globalPresets = null;

async function loadRolesConfig() {
  const grid = document.getElementById('roles-grid');
  const pathBadge = document.getElementById('config-path-badge');
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    globalConfig = data.config;
    globalPresets = data.presets;
    pathBadge.textContent = data.configPath;

    const roles = globalConfig.roles || {};
    grid.innerHTML = Object.entries(roles).map(([roleKey, roleCfg]) => {
      const engine = (roleCfg.engine || 'gemini').toLowerCase();
      const currentModel = roleCfg.model || roleCfg.command || '';
      const effort = roleCfg.defaultReasoningEffort || 'medium';

      const engineOptions = ['claude', 'codex', 'gemini', 'cli'].map(eng => `
        <option value="${eng}" ${eng === engine ? 'selected' : ''}>${eng.toUpperCase()}</option>
      `).join('');

      const presetsForEngine = (globalPresets[engine] || []);
      const presetOptions = presetsForEngine.map(p => `
        <option value="${p.id}" ${p.id === currentModel ? 'selected' : ''}>${p.label}</option>
      `).join('');

      const effortOptions = ['low', 'medium', 'high', 'xhigh'].map(eff => `
        <option value="${eff}" ${eff === effort ? 'selected' : ''}>${eff}</option>
      `).join('');

      const isCli = engine === 'cli';

      return `
        <div class="role-card" id="role-card-${roleKey}">
          <div class="role-header">
            <span class="role-name">${roleKey}</span>
            <span class="role-title-tag">${roleCfg.title || ''}</span>
          </div>

          <div class="form-row">
            <label class="form-label">Engine</label>
            <select class="select-input" onchange="handleEngineChange('${roleKey}', this.value)">
              ${engineOptions}
            </select>
          </div>

          <div class="role-controls">
            <div class="form-row">
              <label class="form-label">${isCli ? 'Command' : 'Model'}</label>
              ${isCli ? `
                <input type="text" class="text-input" id="model-${roleKey}" value="${currentModel}" placeholder="e.g. npm test">
              ` : `
                <select class="select-input" id="model-${roleKey}">
                  ${presetOptions}
                  ${!presetsForEngine.some(p => p.id === currentModel) && currentModel ? `<option value="${currentModel}" selected>${currentModel} (custom)</option>` : ''}
                </select>
              `}
            </div>

            <div class="form-row" style="${isCli ? 'opacity: 0.3; pointer-events: none;' : ''}">
              <label class="form-label">Reasoning Effort</label>
              <select class="select-input" id="effort-${roleKey}">
                ${effortOptions}
              </select>
            </div>
          </div>

          <div class="role-footer">
            <button class="btn btn-sm btn-success" onclick="handleSaveRole('${roleKey}')">Save Role</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="card text-danger">Failed to load roles: ${err.message}</div>`;
  }
}

function handleEngineChange(roleKey, newEngine) {
  const card = document.getElementById(`role-card-${roleKey}`);
  const modelSelect = document.getElementById(`model-${roleKey}`);
  const presets = (globalPresets && globalPresets[newEngine]) || [];

  if (newEngine === 'cli') {
    modelSelect.outerHTML = `<input type="text" class="text-input" id="model-${roleKey}" value="npm test">`;
  } else {
    modelSelect.outerHTML = `
      <select class="select-input" id="model-${roleKey}">
        ${presets.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
      </select>
    `;
  }
}

async function handleSaveRole(roleKey) {
  const card = document.getElementById(`role-card-${roleKey}`);
  const engineSelect = card.querySelector('select');
  const engine = engineSelect.value;
  const modelInput = document.getElementById(`model-${roleKey}`);
  const effortSelect = document.getElementById(`effort-${roleKey}`);

  const payload = {
    role: roleKey,
    engine,
    model: engine !== 'cli' ? modelInput.value : undefined,
    command: engine === 'cli' ? modelInput.value : undefined,
    reasoningEffort: engine !== 'cli' ? effortSelect.value : undefined
  };

  try {
    const res = await fetch(`${API_BASE}/api/config/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Updated role [${roleKey}] -> ${engine} (${payload.model || payload.command})`);
    } else {
      showToast(`Save failed: ${data.error}`, true);
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, true);
  }
}

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadQuotas();
  loadCodexProfiles();
  loadRolesConfig();

  document.getElementById('btn-refresh').addEventListener('click', () => {
    loadQuotas();
    loadCodexProfiles();
    loadRolesConfig();
    showToast('Dashboard refreshed');
  });

  document.getElementById('btn-rotate-next').addEventListener('click', handleRotateNext);
  document.getElementById('btn-save-profile').addEventListener('click', handleSaveCurrentProfile);
  document.getElementById('btn-sync-tokens').addEventListener('click', handleSyncTokens);
  document.getElementById('btn-doctor').addEventListener('click', handleDoctor);
  document.getElementById('btn-restart-daemon').addEventListener('click', handleRestartDaemon);
  document.getElementById('modal-close-btn').addEventListener('click', closeDoctorModal);
  document.getElementById('btn-doctor-ok').addEventListener('click', closeDoctorModal);

  document.getElementById('save-alias-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveCurrentProfile();
  });

  // Auto-refresh every 30s
  setInterval(() => {
    loadQuotas();
    loadCodexProfiles();
  }, 30000);
});
