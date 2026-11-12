// Minimal test harness for the tool suite. Everything runs inside a throwaway sandbox so real ~/.codex,
// ~/.claude and ~/.craft-squad are never read or written.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const queue = [];
const test = (name, fn) => queue.push({ name, fn });

const STUBS = path.join(__dirname, 'stubs');
const jwt = (payload) => 'h.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.s';

/** auth.json contents for a ChatGPT login. */
function codexAuth(email, { accountId = 'acct-' + email, plan = 'plus', refresh = 'RT-' + email, refreshToken = true } = {}) {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const tokens = {
    id_token: jwt({ email, name: 'Test User', exp, 'https://api.openai.com/auth': { chatgpt_account_id: accountId, chatgpt_plan_type: plan } }),
    access_token: jwt({ exp })
  };
  if (refreshToken) tokens.refresh_token = refresh;
  return JSON.stringify({ tokens });
}

function claudeFiles(dir, email, { uuid = 'uuid-' + email, plan = 'pro', stateFile } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stateFile || path.join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: email, accountUuid: uuid, displayName: 'Test User' } }));
  fs.writeFileSync(path.join(dir, '.credentials.json'), JSON.stringify({ claudeAiOauth: { accessToken: 'AT-' + email, refreshToken: 'RT-' + email, subscriptionType: plan } }));
}

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-tool-'));
  const p = (...parts) => path.join(dir, ...parts);
  const env = {
    HOME: dir,
    USERPROFILE: dir,
    CODEX_HOME: p('codex'),
    CX_CODEX_HOME: p('codex-profiles'),
    CX_CLAUDE_HOME: p('claude-profiles'),
    CX_CLAUDE_SYSTEM_DIR: p('claude-system'),
    CX_CODEX_BIN: path.join(STUBS, 'codex-stub.js'),
    CX_CLAUDE_BIN: path.join(STUBS, 'claude-stub.js')
  };
  fs.mkdirSync(env.CODEX_HOME, { recursive: true });
  return { dir, p, env, live: (email, opts) => fs.writeFileSync(path.join(env.CODEX_HOME, 'auth.json'), codexAuth(email, opts)), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

async function waitFor(fn, { timeout = 8000, step = 50 } = {}) {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, step));
  }
}

async function runAll() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of queue) {
    try {
      await fn();
      console.log(`PASS ${name}`);
      passed += 1;
    } catch (err) {
      console.log(`FAIL ${name}\n  ${err && err.stack ? err.stack.split('\n').slice(0, 6).join('\n  ') : err}`);
      failed += 1;
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed} tool tests passed${failed ? `, ${failed} FAILED` : ''}`);
}

module.exports = { test, runAll, assert, sandbox, codexAuth, claudeFiles, waitFor, jwt, STUBS };
