// Accounts tab: one card per provider (Codex, Claude Code) listing accounts by email. No aliases.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { api } from './api.js';
import { toast, confirmDialog, infoDialog, openMenu, skeletonRows } from './ui.js';

const PROVIDERS = {
  codex: {
    title: 'OpenAI Codex',
    icon: 'terminal',
    tone: 'tone-green',
    hint: 'Switching changes the login Codex uses on this computer.',
    useLabel: 'Switch',
    useAction: 'switch',
    removeNote: 'This deletes the saved copy only. Your live Codex login is not changed.'
  },
  claude: {
    title: 'Claude Code',
    icon: 'spark',
    tone: 'tone-amber',
    hint: 'The account in use is the one CraftSquad runs Claude Code with.',
    useLabel: 'Use',
    useAction: 'use',
    removeNote: 'This deletes its stored login. You would need to sign in again to use it.'
  }
};

const state = { data: {}, engines: null, busy: new Set(), polls: new Map(), loaded: false };
let root = null;

const initials = (a) => (a.name || a.email || '?').replace(/[^a-z0-9 ]/gi, ' ').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

async function act(provider, action, body, key) {
  const busyKey = key || `${provider}:${action}`;
  state.busy.add(busyKey);
  render();
  try {
    return await api(`accounts/${provider}/${action}`, { method: 'POST', body });
  } catch (err) {
    toast(err.message, 'error');
    return null;
  } finally {
    state.busy.delete(busyKey);
    render();
  }
}

export async function load({ quiet = false } = {}) {
  try {
    const [accounts, engines] = await Promise.all([api('accounts'), api('status')]);
    state.data = accounts;
    state.engines = engines;
    state.loaded = true;
    for (const provider of Object.keys(PROVIDERS)) {
      for (const p of (accounts[provider] || {}).pending || []) if (p.status === 'waiting') poll(provider, p.token);
    }
    render();
    return true;
  } catch (err) {
    if (!quiet) toast(err.message, 'error');
    return false;
  }
}

function poll(provider, token) {
  if (state.polls.has(token)) return;
  const timer = setInterval(async () => {
    try {
      const p = await api(`accounts/${provider}/pending/${token}`);
      const list = (state.data[provider] && state.data[provider].pending) || [];
      const at = list.findIndex((x) => x.token === token);
      if (at >= 0) list[at] = p;
      if (p.status !== 'waiting') {
        clearInterval(timer);
        state.polls.delete(token);
        if (p.status === 'done') toast(p.result && p.result.created === false ? `${p.result.email} was already added.` : `Added ${(p.result || {}).email || 'account'}.`);
        else if (p.status === 'failed') toast(p.message, 'error');
        await load({ quiet: true });
      } else render();
    } catch (_) {
      clearInterval(timer);
      state.polls.delete(token);
      await load({ quiet: true });
    }
  }, 1500);
  state.polls.set(token, timer);
}

async function addAccount(provider) {
  const res = await act(provider, 'add', {});
  if (res && res.token) {
    toast('Finish signing in from your browser.');
    await load({ quiet: true });
  }
}

async function useAccount(provider, account) {
  const cfg = PROVIDERS[provider];
  const res = await act(provider, cfg.useAction, { id: account.id }, `${provider}:${account.id}`);
  if (!res) return;
  const who = account.email || 'the system default';
  if (provider === 'codex') {
    toast(`Switched to ${who}.${res.autoSaved ? ` Saved your previous login (${res.autoSaved}) first.` : ''}`);
    if (res.openProcesses) setTimeout(() => toast('Restart open Codex windows to use the new account.'), 600);
  } else toast(`CraftSquad will use ${who}.`);
  await load({ quiet: true });
}

async function removeAccount(provider, account) {
  const ok = await confirmDialog({ title: `Remove ${account.email}?`, message: PROVIDERS[provider].removeNote, confirmLabel: 'Remove', danger: true });
  if (!ok) return;
  const res = await act(provider, 'remove', { id: account.id }, `${provider}:${account.id}`);
  if (res) { toast(`Removed ${account.email}.`); await load({ quiet: true }); }
}

async function copyCommand(account) {
  const res = await act('claude', 'command', { id: account.id }, `claude:${account.id}`);
  if (!res) return;
  try {
    await navigator.clipboard.writeText(res.command);
    toast('Command copied. Paste it in a terminal.');
  } catch (_) {
    toast(res.command);
  }
}

async function diagnostics(provider) {
  try {
    const d = await api(`doctor/${provider}`);
    const rows = provider === 'codex'
      ? [['CLI', d.binary], ['Version', d.version], ['Codex home', d.codexHome], ['Live login', d.liveAccount + (d.liveSaved ? '' : ' (not saved)')], ['Saved accounts', d.accounts], ['Running processes', d.openProcesses], ['Account folder', d.accountsRoot]]
      : [['CLI', d.binary], ['Version', d.version], ['System login', d.systemAccount], ['Added accounts', d.accounts], ['In use', d.inUse], ['Account folder', d.accountsRoot], ['Note', d.note]];
    await infoDialog({ title: `${PROVIDERS[provider].title} diagnostics`, rows });
  } catch (err) {
    toast(err.message, 'error');
  }
}

function button(label, { variant = '', iconName, busy, onClick, aria, disabled } = {}) {
  return h('button', { class: `btn ${variant}`, type: 'button', disabled: Boolean(busy || disabled), 'aria-label': aria, on: { click: onClick } },
    busy ? h('span', { class: 'spinner', 'aria-hidden': 'true' }) : iconName && icon(iconName, 15), label ? h('span', { text: label }) : null);
}

function accountRow(provider, a) {
  const cfg = PROVIDERS[provider];
  const busy = state.busy.has(`${provider}:${a.id}`);
  const detail = [a.isSystem ? a.email : null, a.plan, a.organization].filter(Boolean).join(' · ');
  const statusPill = a.isActive ? h('span', { class: 'pill pill-accent', text: 'In use' })
    : a.status === 'needs-signin' ? h('span', { class: 'pill pill-warn', text: 'Needs sign-in' })
    : h('span', { class: 'pill', text: 'Standby' });
  return h('li', { class: `row${a.isActive ? ' row-active' : ''}` },
    h('div', { class: 'avatar', 'aria-hidden': 'true', text: a.isSystem ? 'SY' : initials(a) }),
    h('div', { class: 'grow' },
      h('div', { class: 'row-title', text: a.isSystem ? 'System default' : a.email }),
      h('div', { class: 'row-sub', text: detail || (a.isSystem ? 'Not signed in' : '') })),
    statusPill,
    h('div', { class: 'row-actions' },
      !a.isActive && a.status === 'ready' ? button(cfg.useLabel, { iconName: provider === 'codex' ? 'swap' : 'check', busy, onClick: () => useAccount(provider, a) }) : null,
      provider === 'claude' ? button('', { variant: 'btn-quiet btn-icon', iconName: 'copy', aria: `Copy command to start Claude Code as ${a.email || 'system default'}`, onClick: () => copyCommand(a), disabled: !a.email && !a.isSystem }) : null,
      !a.isSystem ? button('', { variant: 'btn-quiet btn-icon', iconName: 'trash', aria: `Remove ${a.email}`, disabled: busy, onClick: () => removeAccount(provider, a) }) : null));
}

function pendingRow(provider, p) {
  return h('li', { class: 'row' },
    h('div', { class: 'avatar' }, h('span', { class: 'spinner spinner-lg', 'aria-hidden': 'true' })),
    h('div', { class: 'grow' },
      h('div', { class: 'row-title', text: 'Waiting for sign-in' }),
      h('div', { class: 'row-sub' }, p.message, ' ', p.url && /^https?:\/\//.test(p.url) ? h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer', text: 'Open sign-in page' }) : null)),
    h('span', { class: 'pill pill-warn', text: 'Pending' }),
    h('div', { class: 'row-actions' }, button('Cancel', { variant: 'btn-quiet', onClick: async () => { await act(provider, 'cancel', { token: p.token }); await load({ quiet: true }); } })));
}

function providerCard(provider) {
  const cfg = PROVIDERS[provider];
  const data = state.data[provider];
  const engine = state.engines && state.engines[provider];
  const menuItems = provider === 'codex'
    ? [{ label: 'Sync tokens', onSelect: async () => { const r = await act('codex', 'sync', {}); if (r) { toast(r.synced ? `Synced tokens to ${r.email}.` : 'Nothing to sync.'); await load({ quiet: true }); } } },
       { label: 'Restart daemon', onSelect: async () => { const r = await act('codex', 'restart-daemon', {}); if (r) toast(r.message, r.success ? 'info' : 'error'); } },
       { label: 'Diagnostics', onSelect: () => diagnostics('codex') }]
    : [{ label: 'Diagnostics', onSelect: () => diagnostics('claude') }];

  const rows = !state.loaded ? skeletonRows(2)
    : data && data.error ? [h('li', { class: 'empty' }, h('p', { class: 'empty-title', text: "Couldn't load accounts" }), h('p', { class: 'empty-text', text: data.error }))]
    : (() => {
        const list = (data.accounts || []).map((a) => accountRow(provider, a)).concat((data.pending || []).filter((p) => p.status === 'waiting').map((p) => pendingRow(provider, p)));
        const realCount = (data.accounts || []).filter((a) => !a.isSystem).length;
        if (provider === 'codex' && !list.length) {
          return [h('li', { class: 'empty' }, h('p', { class: 'empty-title', text: 'Add your first Codex account' }), h('p', { class: 'empty-text', text: 'Sign in once and switch between accounts here whenever you hit a limit.' }), button('Add account', { variant: 'btn-primary', iconName: 'plus', onClick: () => addAccount('codex') }))];
        }
        if (provider === 'claude' && !realCount && !(data.pending || []).length) {
          list.push(h('li', { class: 'row-hint', text: 'Add another account to switch between logins without signing out.' }));
        }
        return list;
      })();

  const unsaved = provider === 'codex' && data && data.live && !data.liveSaved
    ? h('div', { class: 'banner' }, icon('alert', 16), h('span', { class: 'grow', text: `Your current Codex login (${data.live.email}) isn't saved.` }),
        button('Save login', { variant: 'btn-sm', busy: state.busy.has('codex:save'), onClick: async () => { const r = await act('codex', 'save', {}); if (r) { toast(`Saved ${r.email}.`); await load({ quiet: true }); } } }))
    : null;

  return h('section', { class: 'card', 'aria-labelledby': `h-${provider}` },
    h('header', { class: 'card-head' },
      h('div', { class: `provider-icon ${cfg.tone}` }, icon(cfg.icon, 18)),
      h('div', { class: 'grow' },
        h('h2', { class: 'card-title', id: `h-${provider}`, text: cfg.title }),
        h('p', { class: 'card-sub', text: cfg.hint })),
      engine ? h('span', { class: `chip${engine.installed ? '' : ' chip-warn'}`, text: engine.installed ? engine.version : 'Not installed' }) : null,
      h('button', { class: 'btn btn-icon btn-quiet', type: 'button', 'aria-label': `${cfg.title} actions`, 'aria-haspopup': 'menu', on: { click: (e) => openMenu(e.currentTarget, menuItems) } }, icon('more', 18)),
      button('Add account', { iconName: 'plus', busy: state.busy.has(`${provider}:add`), onClick: () => addAccount(provider) })),
    unsaved,
    h('ul', { class: 'rows' }, rows));
}

export function render() {
  if (!root) return;
  replace(root, providerCard('codex'), providerCard('claude'));
}

export function mount(el) {
  root = el;
  render();
}

export function isBusy() {
  return state.busy.size > 0 || state.polls.size > 0;
}
