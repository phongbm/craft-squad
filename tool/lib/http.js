/**
 * CraftSquad Tool - local HTTP layer (zero dependencies).
 *
 * Threat model: a web page the user visits, or another machine on the LAN, must not be able to drive the account
 * switcher. Defences: loopback-only bind, Host allow-list (DNS rebinding), same-origin check, no CORS headers,
 * a per-boot token required on every API call, JSON-only bodies, strict CSP, and no directory input.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('./errors');

const MAX_BODY = 64 * 1024;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

function secureHeaders(extra = {}) {
  return {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extra
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, secureHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }));
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new ApiError(413, 'Request is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) return resolve({});
      try {
        const parsed = JSON.parse(text);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch (_) {
        reject(new ApiError(400, 'Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * @param {{ publicDir: string, api: (req: {method:string, pathname:string, query:URLSearchParams, body:object}) => Promise<object> }} opts
 */
function createApp({ publicDir, api }) {
  const token = crypto.randomBytes(24).toString('hex');
  let boundPort = null;

  const hostAllowed = (hostHeader) => {
    const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(String(hostHeader || ''));
    if (!match || !LOOPBACK_HOSTS.has(match[1].toLowerCase())) return false;
    return boundPort === null || Number(match[2] || 80) === boundPort;
  };

  const server = http.createServer(async (req, res) => {
    try {
      if (!hostAllowed(req.headers.host)) throw new ApiError(403, 'Forbidden host.');
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname.startsWith('/api/')) {
        if (!safeEqual(req.headers['x-cs-token'], token)) throw new ApiError(403, 'Missing or invalid session token. Reload the page.');
        let body = {};
        if (req.method !== 'GET') {
          const origin = req.headers.origin;
          if (origin && origin !== `http://${req.headers.host}`) throw new ApiError(403, 'Cross-origin requests are not allowed.');
          if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'Send JSON with Content-Type: application/json.');
          body = await readJsonBody(req);
        }
        return sendJson(res, 200, await api({ method: req.method, pathname: url.pathname, query: url.searchParams, body }));
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') throw new ApiError(405, 'Method not allowed.');
      const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const file = path.resolve(publicDir, '.' + requested);
      const rel = path.relative(publicDir, file);
      if (requested.includes('\0') || rel.startsWith('..') || path.isAbsolute(rel)) throw new ApiError(403, 'Forbidden.');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new ApiError(404, 'Not found.');

      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      if (path.basename(file) === 'index.html') {
        const html = fs.readFileSync(file, 'utf8').replace('%%CS_TOKEN%%', token);
        res.writeHead(200, secureHeaders({ 'Content-Type': type, 'Cache-Control': 'no-store' }));
        return res.end(html);
      }
      res.writeHead(200, secureHeaders({ 'Content-Type': type, 'Cache-Control': 'no-cache' }));
      return fs.createReadStream(file).pipe(res);
    } catch (err) {
      if (err instanceof ApiError) {
        if (!res.headersSent) return sendJson(res, err.status, { error: err.message });
        return res.end();
      }
      console.error(err);
      if (!res.headersSent) return sendJson(res, 500, { error: 'Something went wrong. Check the server log.' });
      return res.end();
    }
  });

  server.on('listening', () => { boundPort = server.address().port; });
  return { server, token };
}

module.exports = { createApp, sendJson, MAX_BODY };
