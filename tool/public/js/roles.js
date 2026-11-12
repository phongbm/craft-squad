// Squad roles tab: which engine, model and reasoning effort each role uses (squad.config.json).

import { h, replace } from './dom.js';
import { api } from './api.js';
import { toast } from './ui.js';

const CUSTOM = '__custom__';
let root = null;
let meta = null;

const ENGINE_LABEL = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini', cli: 'Shell command' };
const same = (a, b) => a.engine === b.engine && a.model === b.model && a.effort === b.effort;

function modelOf(cfg) {
  return cfg.engine === 'cli' ? cfg.command || '' : cfg.model || '';
}

function optionList(values, current) {
  return values.map((v) => h('option', { value: v, text: v, selected: v === current }));
}

function roleRow(key, cfg) {
  const original = { engine: cfg.engine || 'gemini', model: modelOf(cfg), effort: cfg.defaultReasoningEffort || 'medium' };
  const draft = { ...original };
  const tr = h('tr');

  const saveBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Save', hidden: true });

  const sync = () => { saveBtn.hidden = same(draft, original); };

  const build = () => {
    const presets = (meta.presets[draft.engine] || []).map((p) => p.id);
    const known = presets.includes(draft.model);
    const isCli = draft.engine === 'cli';

    const engine = h('select', { class: 'select', 'aria-label': `Engine for ${key}`, on: { change: (e) => {
      draft.engine = e.target.value;
      const list = (meta.presets[draft.engine] || []).map((p) => p.id);
      draft.model = list.includes(draft.model) ? draft.model : (list[0] || '');
      build();
      tr.querySelector('select').focus();
    } } }, meta.engines.map((v) => h('option', { value: v, text: ENGINE_LABEL[v] || v, selected: v === draft.engine })));

    const text = h('input', { class: 'input', type: 'text', value: draft.model, maxLength: 200, placeholder: isCli ? 'Command, for example npm test' : 'Model name', 'aria-label': `${isCli ? 'Command' : 'Model'} for ${key}`, on: { input: (e) => { draft.model = e.target.value.trim(); sync(); } } });
    let modelControl = text;
    if (!isCli) {
      const options = [...optionList(presets, draft.model), ...(draft.model && !known ? [h('option', { value: draft.model, text: draft.model, selected: true })] : []), h('option', { value: CUSTOM, text: 'Custom…' })];
      const select = h('select', { class: 'select', 'aria-label': `Model for ${key}`, on: { change: (e) => {
        if (e.target.value === CUSTOM) {
          select.replaceWith(text);
          text.value = '';
          draft.model = '';
          text.focus();
        } else draft.model = e.target.value;
        sync();
      } } }, options);
      modelControl = draft.model || presets.length ? select : text;
    }

    const effort = h('select', { class: 'select', disabled: isCli, 'aria-label': `Reasoning effort for ${key}`, on: { change: (e) => { draft.effort = e.target.value; sync(); } } },
      meta.efforts.map((v) => h('option', { value: v, text: v, selected: v === draft.effort })));

    replace(tr,
      h('td', { 'data-label': 'Role' }, h('div', { class: 'row-title', text: key }), h('div', { class: 'row-sub', text: cfg.title || '' })),
      h('td', { 'data-label': 'Engine' }, engine),
      h('td', { 'data-label': isCli ? 'Command' : 'Model' }, modelControl),
      h('td', { 'data-label': 'Effort' }, effort),
      h('td', { class: 'cell-end' }, saveBtn));
    sync();
  };

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      const isCli = draft.engine === 'cli';
      if (!draft.model) throw new Error(isCli ? 'Enter a command.' : 'Choose or enter a model.');
      await api('config/role', { method: 'POST', body: { role: key, engine: draft.engine, ...(isCli ? { command: draft.model } : { model: draft.model, reasoningEffort: draft.effort }) } });
      Object.assign(original, draft);
      sync();
      toast(`Saved ${key}.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  build();
  return tr;
}

export async function load() {
  try {
    meta = await api('config');
    replace(root,
      h('section', { class: 'card' },
        h('header', { class: 'card-head' },
          h('div', { class: 'grow' },
            h('h2', { class: 'card-title', text: 'Squad roles' }),
            h('p', { class: 'card-sub', text: 'Choose the engine, model, and reasoning effort each role runs with.' })),
          h('span', { class: 'chip chip-mono', title: meta.configPath, text: 'squad.config.json' })),
        h('div', { class: 'table-wrap' },
          h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, ['Role', 'Engine', 'Model', 'Effort', ''].map((t) => h('th', { text: t, scope: 'col' })))),
            h('tbody', {}, Object.entries(meta.config.roles || {}).map(([key, cfg]) => roleRow(key, cfg)))))));
    return true;
  } catch (err) {
    replace(root, h('div', { class: 'empty' }, h('p', { class: 'empty-title', text: "Couldn't load roles" }), h('p', { class: 'empty-text', text: err.message })));
    return false;
  }
}

export function mount(el) {
  root = el;
}
