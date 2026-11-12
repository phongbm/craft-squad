const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, assert } = require('./harness');
const proc = require('../lib/proc');
const safe = require('../../plugin/mcp-server/shared/safe-spawn');

const HOSTILE = ['hello world', 'a&b', '%PATH%', 'say "hi"', 'x|y', 'back\\', '(paren)', '!bang!', 'semi;colon', 'a^b', '--flag=with space'];

function cmdShim() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-shim-'));
  fs.writeFileSync(path.join(dir, 'echo.js'), 'console.log(JSON.stringify(process.argv.slice(2)));');
  const shim = path.join(dir, 'my shim.cmd');
  fs.writeFileSync(shim, '@echo off\r\nnode "%~dp0echo.js" %*\r\n');
  return { dir, shim };
}

test('proc: arguments reach a program unchanged (no shell interpretation)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-proc-'));
  try {
    const script = path.join(dir, 'echo.js');
    fs.writeFileSync(script, 'console.log(JSON.stringify(process.argv.slice(2)));');
    const r = await proc.run(script, HOSTILE);
    assert.strictEqual(r.code, 0);
    assert.deepStrictEqual(JSON.parse(r.stdout), HOSTILE);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('proc: Windows .cmd shims cannot be used for command injection (audit regression)', async () => {
  if (process.platform !== 'win32') return;
  const { dir, shim } = cmdShim();
  try {
    const marker = path.join(dir, 'pwned.txt');
    const r = await proc.run(shim, [...HOSTILE, `x & echo pwned > "${marker}"`]);
    assert.strictEqual(r.code, 0, r.stderr);
    assert.deepStrictEqual(JSON.parse(r.stdout).slice(0, HOSTILE.length), HOSTILE);
    assert(!fs.existsSync(marker), 'injected command must not run');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('plugin safe-spawn has the same guarantee for engine CLI arguments', async () => {
  if (process.platform !== 'win32') return;
  const { dir, shim } = cmdShim();
  try {
    const out = await new Promise((resolve) => {
      let text = '';
      const child = safe.spawnSafe(shim, HOSTILE, { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (d) => { text += d; });
      child.on('close', () => resolve(text));
    });
    assert.deepStrictEqual(JSON.parse(out), HOSTILE);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('proc: run never rejects and reports missing programs and timeouts', async () => {
  const missing = await proc.run(path.join(os.tmpdir(), 'definitely-not-a-binary-xyz'), []);
  assert.notStrictEqual(missing.code, 0);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-proc-'));
  try {
    const script = path.join(dir, 'sleep.js');
    fs.writeFileSync(script, 'setTimeout(()=>{}, 5000);');
    const slow = await proc.run(script, [], { timeout: 200 });
    assert.strictEqual(slow.timedOut, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
