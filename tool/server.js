/**
 * CraftSquad Local Web Studio
 * Zero-dependency HTTP server for the account switcher and squad role editor. Loopback only.
 */

const path = require('path');
const { createApp } = require('./lib/http');
const { createApi } = require('./lib/api');
const { CodexService } = require('./lib/codex/store');
const { ClaudeService } = require('./lib/claude/store');

const PORT = process.env.PORT === undefined ? 4200 : Number(process.env.PORT);
const HOST = process.env.HOST || '127.0.0.1';

const api = createApi({ codex: new CodexService(), claude: new ClaudeService() });
const { server, token } = createApp({ publicDir: path.join(__dirname, 'public'), api });

if (require.main === module) {
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
    console.warn(`Warning: HOST=${HOST} is not loopback. Requests are still limited to localhost Host headers, but do not expose this server.`);
  }
  server.listen(PORT, HOST, () => {
    console.log(`\nCraftSquad Studio is running at http://localhost:${server.address().port}\n`);
  });
}

module.exports = { server, token, api };
