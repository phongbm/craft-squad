const fs = require('fs');
const http = require('http');
const path = require('path');
const { test, assert, sandbox, claudeFiles, waitFor } = require('./harness');
const { createApp } = require('../lib/http');
const { createApi } = require('../lib/api');
const { CodexService } = require('../lib/codex/store');
const { ClaudeService } = require('../lib/claude/store');

async function withServer(sb, fn) {
  const api = createApi({
    codex: new CodexService({ codexHome: sb.env.CODEX_HOME, root: sb.env.CX_CODEX_HOME }),
    claude: new ClaudeService({ root: sb.env.CX_CLAUDE_HOME, systemDir: sb.env.CX_CLAUDE_SYSTEM_DIR })
  });
  const { server, token } = createApp({ publicDir: path.join(__dirname, '..', 'public'), api });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = (method, url, { headers = {}, body, rawBody } = {}) => new Promise((resolve, reject) => {
    const payload = rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers: { Host: `localhost:${port}`, ...headers } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(text); } catch (_) {} resolve({ status: res.statusCode, headers: res.headers, text, json }); });
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
  const authed = (method, url, body, extra = {}) => request(method, url, { body, headers: { 'X-CS-Token': token, ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }), ...extra } });
  try { await fn({ request, authed, token, port, server }); } finally { await new Promise((r) => server.close(r)); }
}

test('server: binds to loopback only', async () => {
  const sb = sandbox();
  try {
    await withServer(sb, async ({ server }) => assert.strictEqual(server.address().address, '127.0.0.1'));
  } finally { sb.cleanup(); }
});

test('server: rejects foreign Host headers (DNS rebinding), missing tokens, bad origins, and non-JSON bodies', async () => {
  const sb = sandbox();
  try {
    await withServer(sb, async ({ request, authed, token, port }) => {
      assert.strictEqual((await request('GET', '/', { headers: { Host: 'evil.example' } })).status, 403);
      assert.strictEqual((await request('GET', '/', { headers: { Host: `localhost:${port + 1}` } })).status, 403);
      assert.strictEqual((await request('GET', '/api/accounts')).status, 403, 'GET without token');
      assert.strictEqual((await request('POST', '/api/accounts/codex/sync', { body: {}, headers: { 'Content-Type': 'application/json' } })).status, 403, 'POST without token');
      assert.strictEqual((await authed('POST', '/api/accounts/codex/sync', {}, { Origin: 'http://evil.example' })).status, 403, 'foreign origin');
      assert.strictEqual((await authed('POST', '/api/accounts/codex/sync', {}, { 'Content-Type': 'text/plain' })).status, 415, 'text/plain simple request');
      assert.strictEqual((await request('POST', '/api/accounts/codex/sync', { rawBody: '{bad', headers: { 'X-CS-Token': token, 'Content-Type': 'application/json' } })).status, 400);
      assert.strictEqual((await request('POST', '/api/accounts/codex/sync', { rawBody: JSON.stringify({ x: 'a'.repeat(70 * 1024) }), headers: { 'X-CS-Token': token, 'Content-Type': 'application/json' } }).catch(() => ({ status: 413 }))).status, 413);
      assert.strictEqual((await authed('GET', '/api/accounts')).status, 200);
    });
  } finally { sb.cleanup(); }
});

test('server: sends no CORS headers and strict security headers; injects the token into index.html only', async () => {
  const sb = sandbox();
  try {
    await withServer(sb, async ({ request, authed, token }) => {
      const page = await request('GET', '/');
      assert.strictEqual(page.status, 200);
      assert(page.text.includes(`content="${token}"`) && !page.text.includes('%%CS_TOKEN%%'));
      assert(!page.headers['access-control-allow-origin']);
      assert(/default-src 'self'/.test(page.headers['content-security-policy']) && /frame-ancestors 'none'/.test(page.headers['content-security-policy']));
      assert.strictEqual(page.headers['x-content-type-options'], 'nosniff');
      assert(!(await request('GET', '/js/main.js')).text.includes(token));
      const preflight = await request('OPTIONS', '/api/accounts', { headers: { Origin: 'http://evil.example' } });
      assert.strictEqual(preflight.status, 403, 'preflights are refused, so cross-origin pages cannot even probe the API');
      assert(!preflight.headers['access-control-allow-origin']);
      for (const probe of ['/%2e%2e/server.js', '/..%2f..%2fpackage.json', '/js/..%5c..%5cserver.js']) {
        const r = await request('GET', probe);
        assert([403, 404].includes(r.status) && !/createApp|workspaces/.test(r.text), `traversal probe ${probe} must not leak files`);
      }
      assert.strictEqual((await request('GET', '/nope.txt')).status, 404);
      assert.strictEqual((await authed('GET', '/api/nope')).status, 404);
    });
  } finally { sb.cleanup(); }
});

test('server: config API ignores directory input and validates role updates', async () => {
  const sb = sandbox();
  const cwd = process.cwd();
  try {
    const projectDir = sb.p('project');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'squad.config.json'), JSON.stringify({ roles: { developer: { engine: 'claude', model: 'sonnet', defaultReasoningEffort: 'medium' } }, engineDefaults: { codex: 'gpt-x' } }));
    process.chdir(projectDir);
    await withServer(sb, async ({ authed }) => {
      const other = sb.p('other');
      fs.mkdirSync(other);
      fs.writeFileSync(path.join(other, 'squad.config.json'), JSON.stringify({ roles: { evil: {} } }));
      const got = await authed('GET', `/api/config?dir=${encodeURIComponent(other)}`);
      assert.strictEqual(got.status, 200);
      assert(got.json.config.roles.developer && !got.json.config.roles.evil, 'dir parameter must be ignored');
      assert(got.json.presets.claude.some((p) => p.id === 'sonnet') && got.json.presets.codex.some((p) => p.id === 'gpt-x'));
      assert.strictEqual((await authed('POST', '/api/config/role', { role: 'developer', engine: 'bash' })).status, 400);
      assert.strictEqual((await authed('POST', '/api/config/role', { role: 'ghost', engine: 'claude' })).status, 404);
      assert.strictEqual((await authed('POST', '/api/config/role', { role: 'developer', model: 'x\u0000y' })).status, 400);
      const ok = await authed('POST', '/api/config/role', { role: 'developer', engine: 'codex', model: 'gpt-y', reasoningEffort: 'high' });
      assert.strictEqual(ok.status, 200);
      const saved = JSON.parse(fs.readFileSync(path.join(projectDir, 'squad.config.json'), 'utf8'));
      assert.deepStrictEqual(saved.roles.developer, { engine: 'codex', model: 'gpt-y', defaultReasoningEffort: 'high' });
    });
  } finally { process.chdir(cwd); sb.cleanup(); }
});

test('server: account flow over HTTP (add via sign-in, switch, use, remove) with validation errors as 4xx', async () => {
  const sb = sandbox();
  const keep = { ...process.env };
  try {
    Object.assign(process.env, { STUB_DELAY_MS: '150', STUB_EMAIL: 'new@x.com' });
    sb.live('live@x.com');
    claudeFiles(sb.env.CX_CLAUDE_SYSTEM_DIR, 'sys@x.com');
    await withServer(sb, async ({ authed }) => {
      let list = (await authed('GET', '/api/accounts')).json;
      assert.strictEqual(list.codex.liveSaved, false);
      assert.strictEqual((await authed('POST', '/api/accounts/codex/save', {})).status, 200);
      const add = await authed('POST', '/api/accounts/codex/add', {});
      assert.strictEqual(add.status, 200);
      const done = await waitFor(async () => { const p = (await authed('GET', `/api/accounts/codex/pending/${add.json.token}`)).json; return p.status !== 'waiting' ? p : null; });
      assert.strictEqual(done.status, 'done');
      list = (await authed('GET', '/api/accounts')).json;
      assert.deepStrictEqual(list.codex.accounts.map((a) => a.email), ['live@x.com', 'new@x.com']);
      const sw = await authed('POST', '/api/accounts/codex/switch', { id: 'new@x.com', restartDaemon: false });
      assert.strictEqual(sw.status, 200);
      assert.strictEqual((await authed('GET', '/api/accounts')).json.codex.accounts.find((a) => a.isActive).email, 'new@x.com');
      assert.strictEqual((await authed('POST', '/api/accounts/codex/switch', { id: 'ghost' })).status, 404);
      assert.strictEqual((await authed('POST', '/api/accounts/codex/switch', {})).status, 400);
      assert.strictEqual((await authed('POST', '/api/accounts/codex/bogus', {})).status, 404);
      assert.strictEqual((await authed('POST', '/api/accounts/codex/constructor', {})).status, 404);
      assert.strictEqual((await authed('POST', '/api/accounts/claude/add', { email: 'not-an-email' })).status, 400);
      const cadd = await authed('POST', '/api/accounts/claude/add', { email: 'c@x.com' });
      await waitFor(async () => (await authed('GET', `/api/accounts/claude/pending/${cadd.json.token}`)).json.status === 'done');
      assert.strictEqual((await authed('POST', '/api/accounts/claude/use', { id: 'new@x.com' })).status, 200);
      list = (await authed('GET', '/api/accounts')).json;
      assert.strictEqual(list.claude.accounts.find((a) => a.isActive).id, 'new@x.com');
      assert.strictEqual((await authed('POST', '/api/accounts/claude/remove', { id: 'new@x.com' })).status, 200);
      assert.strictEqual((await authed('POST', '/api/accounts/codex/remove', { id: 'live@x.com' })).status, 200);
      assert.strictEqual((await authed('GET', '/api/doctor/codex')).status, 200);
      assert.strictEqual((await authed('GET', '/api/status')).json.codex.installed, true);
    });
  } finally { for (const k of ['STUB_DELAY_MS', 'STUB_EMAIL']) delete process.env[k]; Object.assign(process.env, keep); sb.cleanup(); }
});
