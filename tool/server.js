/**
 * CraftSquad Local Web Server
 * Zero-dependency native HTTP server serving the Web Dashboard and API endpoints.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const { getSquadConfig, updateRoleConfig, updateEngineDefault } = require('./lib/squad-manager');
const { codexManager, restartDaemon } = require('./lib/codex-manager');
const { getUnifiedQuotaStatus } = require('./lib/quota-monitor');

const PORT = Number(process.env.PORT) || 4200;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  try {
    // API: Squad Config
    if (pathname === '/api/config' && req.method === 'GET') {
      const data = getSquadConfig(reqUrl.searchParams.get('dir'));
      return sendJson(res, data.success ? 200 : 500, data);
    }

    if (pathname === '/api/config/role' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const data = updateRoleConfig(body.role, body, body.workingDirectory);
      return sendJson(res, data.success ? 200 : 400, data);
    }

    if (pathname === '/api/config/engine-default' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const data = updateEngineDefault(body.engine, body.model, body.workingDirectory);
      return sendJson(res, data.success ? 200 : 400, data);
    }

    // API: ChatGPT Codex Native Switcher & Sync Engine
    if (pathname === '/api/codex/profiles' && req.method === 'GET') {
      const data = codexManager.listProfiles();
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/codex/switch' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const data = codexManager.switchProfile(body.alias);
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/codex/rotate' && req.method === 'POST') {
      const data = codexManager.rotateNext();
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/codex/save' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const data = codexManager.saveCurrentAsProfile(body.alias);
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/codex/remove' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const data = codexManager.removeProfile(body.alias);
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/codex/sync' && req.method === 'POST') {
      const syncedAlias = codexManager.syncCurrentAuthToProfile();
      return sendJson(res, 200, {
        success: true,
        syncedProfile: syncedAlias,
        message: syncedAlias ? `Synced tokens to profile '${syncedAlias}'` : 'No active profile to sync'
      });
    }

    if (pathname === '/api/codex/restart-daemon' && req.method === 'POST') {
      const data = restartDaemon();
      return sendJson(res, 200, data);
    }

    if (pathname === '/api/codex/doctor' && req.method === 'GET') {
      const data = codexManager.doctor();
      return sendJson(res, 200, { success: true, doctor: data });
    }

    // API: Multi-Engine Quotas & Health
    if (pathname === '/api/quota' && req.method === 'GET') {
      const data = getUnifiedQuotaStatus();
      return sendJson(res, 200, data);
    }

    // Static Assets
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Access Denied');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback to index.html for SPA
    const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(fallbackPath).pipe(res);
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n===============================================================`);
  console.log(`🚀 CraftSquad Management Tool & Quota Monitor is running!`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`===============================================================\n`);
});

module.exports = server;
