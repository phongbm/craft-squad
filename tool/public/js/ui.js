// Shared UI pieces: toasts, confirm/info dialogs, and the overflow menu.

import { h, replace } from './dom.js';
import { icon } from './icons.js';

export function toast(message, type = 'info') {
  const root = document.getElementById('toasts');
  const item = h('div', { class: `toast toast-${type}` }, icon(type === 'error' ? 'alert' : 'check', 16), h('span', { text: message }));
  root.append(item);
  setTimeout(() => item.classList.add('leaving'), type === 'error' ? 7000 : 4000);
  setTimeout(() => item.remove(), type === 'error' ? 7300 : 4300);
}

function openDialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const root = document.getElementById('modal-root');
    const close = (value) => {
      document.removeEventListener('keydown', onKey);
      root.replaceChildren();
      if (previous && previous.focus) previous.focus();
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const buttons = actions.map((a) => h('button', { class: `btn ${a.class || ''}`, type: 'button', text: a.label, on: { click: () => close(a.value) } }));
    const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('h2', { class: 'modal-title', text: title }),
      body,
      h('div', { class: 'modal-actions' }, buttons));
    let downOnBackdrop = false;
    root.replaceChildren(h('div', { class: 'backdrop', on: {
      mousedown: (e) => { downOnBackdrop = e.target === e.currentTarget; },
      click: (e) => { if (downOnBackdrop && e.target === e.currentTarget) close(false); downOnBackdrop = false; }
    } }, dialog));
    document.addEventListener('keydown', onKey);
    (buttons[buttons.length - 1] || dialog).focus();
  });
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return openDialog({
    title,
    body: h('p', { class: 'modal-text', text: message }),
    actions: [{ label: 'Cancel', value: false }, { label: confirmLabel, value: true, class: danger ? 'btn-danger' : 'btn-primary' }]
  });
}

export function infoDialog({ title, rows }) {
  const list = h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v === undefined || v === null || v === '' ? 'None' : String(v) })]));
  return openDialog({ title, body: list, actions: [{ label: 'Close', value: true, class: 'btn-primary' }] });
}

let closeMenu = null;

/** Small popover menu anchored under a button. items: [{ label, onSelect }] */
export function openMenu(anchor, items) {
  if (closeMenu) closeMenu();
  const menu = h('div', { class: 'menu', role: 'menu' }, items.map((item) =>
    h('button', { class: 'menu-item', type: 'button', role: 'menuitem', text: item.label, on: { click: () => { dismiss(); item.onSelect(); } } })));
  const rect = anchor.getBoundingClientRect();
  document.body.append(menu);
  menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
  menu.style.left = `${Math.max(8, rect.right + window.scrollX - menu.offsetWidth)}px`;
  const onDoc = (e) => { if (!menu.contains(e.target) && e.target !== anchor) dismiss(); };
  const onKey = (e) => { if (e.key === 'Escape') { dismiss(); anchor.focus(); } };
  function dismiss() {
    menu.remove();
    document.removeEventListener('mousedown', onDoc);
    document.removeEventListener('keydown', onKey);
    closeMenu = null;
  }
  closeMenu = dismiss;
  setTimeout(() => document.addEventListener('mousedown', onDoc));
  document.addEventListener('keydown', onKey);
  menu.querySelector('button')?.focus();
}

export function skeletonRows(count = 2) {
  return Array.from({ length: count }, () => h('div', { class: 'row' }, h('div', { class: 'avatar skeleton' }), h('div', { class: 'grow' }, h('div', { class: 'skeleton line w-40' }), h('div', { class: 'skeleton line w-25' }))));
}

export { replace };
