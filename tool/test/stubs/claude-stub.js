// Fake `claude` CLI for tests and UI demos (set CX_CLAUDE_BIN to this file). Never talks to the network.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args[0] === '--version') {
  console.log('0.0.0-stub (Claude Code)');
} else if (args[0] === 'auth' && args[1] === 'login') {
  const email = process.env.STUB_EMAIL || args[args.indexOf('--email') + 1] || 'new@example.com';
  console.log('Open https://claude.example.test/login?code=STUB to sign in');
  setTimeout(() => {
    if (process.env.STUB_FAIL) process.exit(1);
    const dir = process.env.CLAUDE_CONFIG_DIR;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: email, accountUuid: 'uuid-' + email, displayName: 'Stub User' } }));
    fs.writeFileSync(path.join(dir, '.credentials.json'), JSON.stringify({ claudeAiOauth: { accessToken: 'AT-' + email, refreshToken: 'RT-' + email, subscriptionType: 'pro' } }));
    process.exit(0);
  }, Number(process.env.STUB_DELAY_MS || 300));
} else {
  console.log(JSON.stringify({ args, configDir: process.env.CLAUDE_CONFIG_DIR || null }));
}
