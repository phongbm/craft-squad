// Studio bootstrap: tabs, refresh, connection indicator, and auto-refresh.

import * as accounts from './accounts.js';
import * as roles from './roles.js';

const views = {
  accounts: { el: document.getElementById('view-accounts'), tab: document.getElementById('tab-accounts'), load: () => accounts.load() },
  roles: { el: document.getElementById('view-roles'), tab: document.getElementById('tab-roles'), load: () => roles.load() }
};
const conn = document.getElementById('conn');
let current = 'accounts';

function setConnection(ok) {
  conn.className = `conn ${ok ? 'conn-ok' : 'conn-off'}`;
  conn.textContent = ok ? 'Connected' : 'Offline';
}

async function refresh() {
  setConnection(await views[current].load());
}

function show(name) {
  if (!views[name]) name = 'accounts';
  current = name;
  for (const [key, v] of Object.entries(views)) {
    v.el.hidden = key !== name;
    v.tab.setAttribute('aria-selected', String(key === name));
    v.tab.tabIndex = key === name ? 0 : -1;
  }
  history.replaceState(null, '', `#${name}`);
  refresh();
}

accounts.mount(views.accounts.el);
roles.mount(views.roles.el);

for (const [key, v] of Object.entries(views)) {
  v.tab.addEventListener('click', () => show(key));
  v.tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const keys = Object.keys(views);
    const next = keys[(keys.indexOf(key) + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length];
    show(next);
    views[next].tab.focus();
  });
}

document.getElementById('refresh').addEventListener('click', refresh);

setInterval(() => {
  if (current === 'accounts' && !document.hidden && !accounts.isBusy()) accounts.load({ quiet: true }).then(setConnection);
}, 30000);

show(location.hash.slice(1));
