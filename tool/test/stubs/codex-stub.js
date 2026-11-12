// Fake `codex` CLI for tests and UI demos (set CX_CODEX_BIN to this file). Never talks to the network.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const jwt = (p) => 'h.' + Buffer.from(JSON.stringify(p)).toString('base64url') + '.s';

if (args[0] === '--version') {
  console.log('codex-cli 0.0.0-stub');
} else if (args[0] === 'login') {
  const email = process.env.STUB_EMAIL || 'new@example.com';
  const exp = Math.floor(Date.now() / 1000) + 86400;
  console.log('Open https://auth.example.test/login?code=STUB to sign in');
  setTimeout(() => {
    if (process.env.STUB_FAIL) process.exit(1);
    const home = process.env.CODEX_HOME;
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'auth.json'), JSON.stringify({
      tokens: {
        id_token: jwt({ email, name: 'Stub User', exp, 'https://api.openai.com/auth': { chatgpt_account_id: 'acct-' + email, chatgpt_plan_type: 'plus' } }),
        access_token: jwt({ exp }),
        refresh_token: 'RT-' + email
      }
    }));
    process.exit(0);
  }, Number(process.env.STUB_DELAY_MS || 300));
} else if (args[0] === 'app-server') {
  console.log('stub daemon restarted');
} else {
  console.log(JSON.stringify(args));
}
