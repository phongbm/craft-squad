const fs = require('fs');
const path = require('path');
const { test, assert, sandbox, codexAuth, claudeFiles, waitFor } = require('./harness');
const { CodexService } = require('../lib/codex/store');
const { ClaudeService } = require('../lib/claude/store');
const { selectedClaudeAccount } = require('../../plugin/mcp-server/modules/claude-account');

const svc = (sb) => new CodexService({ codexHome: sb.env.CODEX_HOME, root: sb.env.CX_CODEX_HOME });
const readRt = (sb, id) => JSON.parse(fs.readFileSync(path.join(sb.env.CX_CODEX_HOME, id, 'auth.json'), 'utf8')).tokens.refresh_token;

test('codex: legacy alias folders migrate to email ids, aliases are dropped', () => {
  const sb = sandbox();
  try {
    const legacy = path.join(sb.env.CODEX_HOME, 'profiles', 'my-alias');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'auth.json'), codexAuth('a@x.com'));
    fs.writeFileSync(path.join(legacy, 'meta.json'), JSON.stringify({ alias: 'my-alias', email: 'a@x.com', created_at: '2026-01-01T00:00:00.000Z' }));
    fs.writeFileSync(path.join(sb.env.CODEX_HOME, 'profiles', 'state.json'), JSON.stringify({ active_profile: 'my-alias' }));
    const s = svc(sb);
    const list = s.list();
    assert.deepStrictEqual(list.accounts.map((a) => a.id), ['a@x.com']);
    assert(!fs.existsSync(path.join(sb.env.CODEX_HOME, 'profiles')), 'legacy folder removed after migration');
    const meta = JSON.parse(fs.readFileSync(path.join(sb.env.CX_CODEX_HOME, 'a@x.com', 'meta.json'), 'utf8'));
    assert.strictEqual(meta.alias, undefined);
    assert.strictEqual(meta.created_at, '2026-01-01T00:00:00.000Z', 'creation time is preserved');
    assert(!fs.existsSync(path.join(sb.env.CX_CODEX_HOME, 'my-alias')), 'alias folder renamed');
  } finally { sb.cleanup(); }
});

test('codex: migration renames already-saved alias folders and never overwrites', () => {
  const sb = sandbox();
  try {
    const root = sb.env.CX_CODEX_HOME;
    for (const [alias, email] of [['s1.phongbm', 's1@x.com'], ['work', 'w@x.com']]) {
      fs.mkdirSync(path.join(root, alias), { recursive: true });
      fs.writeFileSync(path.join(root, alias, 'auth.json'), codexAuth(email));
      fs.writeFileSync(path.join(root, alias, 'meta.json'), JSON.stringify({ alias, email }));
    }
    // A folder that already owns the target id must not be overwritten.
    fs.mkdirSync(path.join(root, 'w@x.com'), { recursive: true });
    fs.writeFileSync(path.join(root, 'w@x.com', 'auth.json'), codexAuth('w@x.com', { refresh: 'KEEP' }));
    const s = svc(sb);
    const ids = s.list().accounts.map((a) => a.id).sort();
    assert(ids.includes('s1@x.com') && ids.includes('w@x.com'));
    assert.strictEqual(readRt(sb, 'w@x.com'), 'KEEP');
  } finally { sb.cleanup(); }
});

test('codex: saving is an upsert by identity; same email in another workspace gets its own id', () => {
  const sb = sandbox();
  try {
    const s = svc(sb);
    sb.live('a@x.com', { refresh: 'RT1' });
    assert.strictEqual(s.saveLive().created, true);
    sb.live('a@x.com', { refresh: 'RT2' });
    const again = s.saveLive();
    assert.strictEqual(again.created, false);
    assert.strictEqual(s.list().accounts.length, 1);
    assert.strictEqual(readRt(sb, 'a@x.com'), 'RT2');
    sb.live('a@x.com', { accountId: 'team-workspace', refresh: 'RT3' });
    const team = s.saveLive();
    assert.strictEqual(team.created, true);
    assert(team.id.startsWith('a@x.com~'), team.id);
    assert.strictEqual(s.list().accounts.length, 2);
  } finally { sb.cleanup(); }
});

test('codex: sync never overwrites a saved account with a different live login (audit regression)', () => {
  const sb = sandbox();
  try {
    const s = svc(sb);
    sb.live('a@x.com', { refresh: 'RT-A' });
    s.saveLive();
    sb.live('b@x.com', { refresh: 'RT-B' });
    assert.strictEqual(s.sync().synced, null);
    assert.strictEqual(readRt(sb, 'a@x.com'), 'RT-A');
    // Same account with refreshed tokens does sync back.
    sb.live('a@x.com', { refresh: 'RT-A2' });
    assert.strictEqual(s.sync().synced, 'a@x.com');
    assert.strictEqual(readRt(sb, 'a@x.com'), 'RT-A2');
  } finally { sb.cleanup(); }
});

test('codex: switching saves the unsaved live login, backs it up, and derives the active account', async () => {
  const sb = sandbox();
  try {
    const s = svc(sb);
    sb.live('a@x.com');
    s.saveLive();
    sb.live('b@x.com'); // user signed in with Codex directly
    const r = await s.switchTo('a@x.com', { restartDaemon: false });
    assert.strictEqual(r.autoSaved, 'b@x.com');
    const list = s.list();
    assert.deepStrictEqual(list.accounts.map((a) => [a.email, a.isActive]), [['a@x.com', true], ['b@x.com', false]]);
    assert.strictEqual(list.liveSaved, true);
    const backups = fs.readdirSync(path.join(sb.env.CX_CODEX_HOME, '.backup'));
    assert.strictEqual(backups.length, 1);
    if (process.platform !== 'win32') assert.strictEqual(fs.statSync(path.join(sb.env.CX_CODEX_HOME, '.backup', backups[0])).mode & 0o777, 0o600);
    assert.strictEqual((await s.switchTo('a@x.com', { restartDaemon: false })).alreadyActive, true);
  } finally { sb.cleanup(); }
});

test('codex: rotate uses refresh tokens, not access-token expiry; selectors resolve by id, number, or prefix', async () => {
  const sb = sandbox();
  try {
    const s = svc(sb);
    for (const e of ['a@x.com', 'b@x.com', 'c@x.com']) { sb.live(e, { refreshToken: e !== 'b@x.com' }); s.saveLive(); }
    sb.live('a@x.com');
    const r = await s.rotate({ restartDaemon: false });
    assert.strictEqual(r.email, 'c@x.com', 'skips the account without a refresh token');
    assert.strictEqual(s.store.select('1').identity.email, 'a@x.com');
    assert.strictEqual(s.store.select('b@').identity.email, 'b@x.com');
    assert.strictEqual(s.store.select('C@X.COM').identity.email, 'c@x.com');
    assert.throws(() => s.store.select('9'), /No account number 9/);
    assert.throws(() => s.store.select('nobody'), /No account matches/);
    await assert.rejects(() => s.switchTo('b@x.com', { restartDaemon: false }), /sign in again/);
  } finally { sb.cleanup(); }
});

test('codex: remove deletes only the saved copy; live login stays', () => {
  const sb = sandbox();
  try {
    const s = svc(sb);
    sb.live('a@x.com');
    s.saveLive();
    s.remove('a@x.com');
    assert.strictEqual(s.list().accounts.length, 0);
    assert(fs.existsSync(path.join(sb.env.CODEX_HOME, 'auth.json')));
    assert.strictEqual(s.list().liveSaved, false);
  } finally { sb.cleanup(); }
});

test('codex: add runs a sign-in in an isolated CODEX_HOME and imports it without touching the live login', async () => {
  const sb = sandbox();
  const keep = { ...process.env };
  try {
    sb.live('live@x.com');
    const liveBefore = fs.readFileSync(path.join(sb.env.CODEX_HOME, 'auth.json'), 'utf8');
    Object.assign(process.env, { STUB_EMAIL: 'new@x.com', STUB_DELAY_MS: '150' });
    const s = svc(sb);
    const { token } = await s.add();
    const done = await waitFor(() => { const p = s.pending(token); return p.status !== 'waiting' ? p : null; });
    assert.strictEqual(done.status, 'done', done.message);
    assert(/^https:/.test(done.url), 'sign-in link is surfaced');
    assert.deepStrictEqual(s.list().accounts.map((a) => a.email), ['new@x.com']);
    assert.strictEqual(fs.readFileSync(path.join(sb.env.CODEX_HOME, 'auth.json'), 'utf8'), liveBefore);
    process.env.STUB_FAIL = '1';
    const failing = await s.add();
    const bad = await waitFor(() => { const p = s.pending(failing.token); return p.status !== 'waiting' ? p : null; });
    assert.strictEqual(bad.status, 'failed');
  } finally { for (const k of ['STUB_EMAIL', 'STUB_DELAY_MS', 'STUB_FAIL']) delete process.env[k]; Object.assign(process.env, keep); sb.cleanup(); }
});

test('claude: accounts are config dirs; use/remove drive the dispatcher selection', () => {
  const sb = sandbox();
  try {
    claudeFiles(sb.env.CX_CLAUDE_SYSTEM_DIR, 'sys@x.com', { plan: 'max' });
    claudeFiles(path.join(sb.env.CX_CLAUDE_HOME, 'work@x.com'), 'work@x.com');
    const c = new ClaudeService({ root: sb.env.CX_CLAUDE_HOME, systemDir: sb.env.CX_CLAUDE_SYSTEM_DIR });
    let rows = c.list().accounts;
    assert.deepStrictEqual(rows.map((r) => [r.id, r.isActive]), [['system', true], ['work@x.com', false]]);
    assert.strictEqual(selectedClaudeAccount({ CX_CLAUDE_HOME: sb.env.CX_CLAUDE_HOME }), null);
    c.use('work');
    assert.strictEqual(c.list().accounts.find((r) => r.isActive).id, 'work@x.com');
    assert.strictEqual(selectedClaudeAccount({ CX_CLAUDE_HOME: sb.env.CX_CLAUDE_HOME }).id, 'work@x.com');
    assert(c.launchCommand('work@x.com', 'sh').command.includes('CLAUDE_CONFIG_DIR='));
    assert.throws(() => c.remove('system'), /cannot be removed/);
    c.remove('work@x.com');
    assert.strictEqual(selectedClaudeAccount({ CX_CLAUDE_HOME: sb.env.CX_CLAUDE_HOME }), null);
    assert(!fs.existsSync(path.join(sb.env.CX_CLAUDE_HOME, 'work@x.com')));
    assert.strictEqual(c.list().accounts.find((r) => r.isActive).id, 'system');
  } finally { sb.cleanup(); }
});

test('claude: add signs in inside a hidden pending dir, renames it to the email id, and skips duplicates', async () => {
  const sb = sandbox();
  const keep = { ...process.env };
  try {
    Object.assign(process.env, { STUB_DELAY_MS: '150' });
    const c = new ClaudeService({ root: sb.env.CX_CLAUDE_HOME, systemDir: sb.env.CX_CLAUDE_SYSTEM_DIR });
    const first = await c.add({ email: 'new@x.com' });
    const done = await waitFor(() => { const p = c.pending(first.token); return p.status !== 'waiting' ? p : null; });
    assert.strictEqual(done.status, 'done', done.message);
    assert.deepStrictEqual(done.result, { id: 'new@x.com', email: 'new@x.com', created: true });
    assert.deepStrictEqual(fs.readdirSync(sb.env.CX_CLAUDE_HOME).filter((n) => n.startsWith('_pending')), []);
    const second = await c.add({ email: 'new@x.com' });
    const dup = await waitFor(() => { const p = c.pending(second.token); return p.status !== 'waiting' ? p : null; });
    assert.strictEqual(dup.result.created, false);
    assert.strictEqual(c.list().accounts.filter((r) => !r.isSystem).length, 1);
    const third = await c.add({});
    c.cancel(third.token);
    assert.deepStrictEqual(fs.readdirSync(sb.env.CX_CLAUDE_HOME).filter((n) => n.startsWith('_pending')), [], 'cancel cleans the pending dir');
  } finally { Object.assign(process.env, keep); delete process.env.STUB_DELAY_MS; sb.cleanup(); }
});

test('plugin dispatch uses the selected Claude account (dry run)', async () => {
  const sb = sandbox();
  const keep = process.env.CX_CLAUDE_HOME;
  try {
    claudeFiles(path.join(sb.env.CX_CLAUDE_HOME, 'work@x.com'), 'work@x.com');
    new ClaudeService({ root: sb.env.CX_CLAUDE_HOME, systemDir: sb.env.CX_CLAUDE_SYSTEM_DIR }).use('work@x.com');
    process.env.CX_CLAUDE_HOME = sb.env.CX_CLAUDE_HOME;
    const { dispatchRole } = require('../../plugin/mcp-server/modules/dispatcher');
    const r = await dispatchRole('developer', 'check', { dryRun: true, workingDirectory: path.join(__dirname, '..', '..', 'plugin') });
    assert.strictEqual(r.claudeAccount, 'work@x.com');
    assert.strictEqual(r.claudeConfigDir, path.join(sb.env.CX_CLAUDE_HOME, 'work@x.com'));
  } finally { if (keep === undefined) delete process.env.CX_CLAUDE_HOME; else process.env.CX_CLAUDE_HOME = keep; sb.cleanup(); }
});
