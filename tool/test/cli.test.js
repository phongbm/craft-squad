const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, assert, sandbox, codexAuth, claudeFiles } = require('./harness');

const CX = path.join(__dirname, '..', 'bin', 'cx.js');
const cx = (sb, ...args) => spawnSync(process.execPath, [CX, ...args], { encoding: 'utf8', env: { ...process.env, ...sb.env, STUB_DELAY_MS: '100', STUB_EMAIL: 'added@x.com' }, timeout: 30000 });

test('cx: list/save/switch/remove work by email, number, or prefix; no aliases anywhere', () => {
  const sb = sandbox();
  try {
    sb.live('a@x.com');
    assert.strictEqual(cx(sb, 'save').status, 0);
    sb.live('b@x.com');
    assert.strictEqual(cx(sb, 'save').status, 0);
    const list = cx(sb, 'list');
    assert(list.stdout.includes('a@x.com') && list.stdout.includes('b@x.com') && list.stdout.includes('IN USE'), list.stdout);
    assert(!/alias/i.test(list.stdout));
    const sw = cx(sb, 'switch', 'a@', '--no-daemon');
    assert.strictEqual(sw.status, 0, sw.stderr);
    assert(sw.stdout.includes('Switched to a@x.com'));
    assert(cx(sb, 'current').stdout.includes('a@x.com'));
    assert.strictEqual(cx(sb, '2', '--no-daemon').status, 0, 'a bare number switches');
    assert(cx(sb, 'current').stdout.includes('b@x.com'));
    assert.strictEqual(cx(sb, 'remove', 'a@x.com').status, 0);
    assert(!cx(sb, 'list').stdout.includes('a@x.com'));
  } finally { sb.cleanup(); }
});

test('cx: typos and unknown commands fail instead of switching accounts', () => {
  const sb = sandbox();
  try {
    sb.live('a@x.com');
    cx(sb, 'save');
    sb.live('b@x.com');
    const before = fs.readFileSync(path.join(sb.env.CODEX_HOME, 'auth.json'), 'utf8');
    for (const bad of ['lst', 'swich', 'a']) {
      const r = cx(sb, bad);
      assert.strictEqual(r.status, 1, `"${bad}" should fail`);
      assert(/Unknown command/.test(r.stderr));
    }
    assert.strictEqual(fs.readFileSync(path.join(sb.env.CODEX_HOME, 'auth.json'), 'utf8'), before);
    assert.strictEqual(cx(sb, 'switch').status, 1);
    assert(!/--resume/.test(cx(sb, '--help').stdout), '--resume was never implemented');
  } finally { sb.cleanup(); }
});

test('cx: add signs in through the CLI and codex prefix is optional', () => {
  const sb = sandbox();
  try {
    const add = cx(sb, 'codex', 'add');
    assert.strictEqual(add.status, 0, add.stderr);
    assert(add.stdout.includes('Added added@x.com') && add.stdout.includes('https://'), add.stdout);
    assert(cx(sb, 'codex', 'list').stdout.includes('added@x.com'));
    assert(cx(sb, 'doctor').stdout.includes('codex-cli 0.0.0-stub'));
  } finally { sb.cleanup(); }
});

test('cx claude: add/use/env/run/remove work by email and never expose tokens', () => {
  const sb = sandbox();
  try {
    claudeFiles(sb.env.CX_CLAUDE_SYSTEM_DIR, 'sys@x.com');
    const add = cx(sb, 'claude', 'add');
    assert.strictEqual(add.status, 0, add.stderr);
    const list = cx(sb, 'claude', 'list');
    assert(list.stdout.includes('added@x.com') && list.stdout.includes('System default (sys@x.com)'), list.stdout);
    assert(!/AT-|RT-/.test(list.stdout + list.stderr), 'tokens must never be printed');
    assert.strictEqual(cx(sb, 'claude', 'use', 'added').status, 0);
    assert(cx(sb, 'claude', 'current').stdout.includes('added@x.com'));
    assert(cx(sb, 'claude', 'env', '1', '--shell', 'sh').stdout.includes("CLAUDE_CONFIG_DIR='"));
    const run = cx(sb, 'claude', 'run', 'added@x.com', '--', '-p', 'hello world', 'a&b');
    assert.strictEqual(run.status, 0, run.stderr);
    const out = JSON.parse(run.stdout.trim().split('\n').pop());
    assert.deepStrictEqual(out.args, ['-p', 'hello world', 'a&b']);
    assert(out.configDir.endsWith('added@x.com'));
    const sys = cx(sb, 'claude', 'run', 'system', 'x');
    assert.strictEqual(sys.status, 0, sys.stderr);
    assert.strictEqual(JSON.parse(sys.stdout.trim().split('\n').pop()).configDir, null, 'system default must run without CLAUDE_CONFIG_DIR');
    assert.strictEqual(cx(sb, 'claude', 'bogus').status, 1);
    assert.strictEqual(cx(sb, 'claude', 'remove', 'added@x.com').status, 0);
    assert(cx(sb, 'claude', 'current').stdout.includes('System default'));
  } finally { sb.cleanup(); }
});

test('cx: --help documents both providers and the shortcut', () => {
  const sb = sandbox();
  try {
    const help = cx(sb, '--help').stdout;
    assert(help.includes('CraftSquad Account Switcher') && help.includes('cx claude') && help.includes('<email|#>'));
  } finally { sb.cleanup(); }
});
