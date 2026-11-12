/**
 * CraftSquad Tool - in-memory registry of browser sign-ins started from the UI/CLI.
 * A sign-in is a child process (`codex login` / `claude auth login`) whose result is imported when it exits.
 */

const crypto = require('crypto');

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/;
const KEEP_MS = 10 * 60 * 1000;

class PendingLogins {
  constructor() {
    this.items = new Map();
  }

  /**
   * @param {{ provider: string, start: () => import('child_process').ChildProcess, finalize: () => object, cleanup?: () => void, timeoutMs?: number }} spec
   * @returns {string} token
   */
  start({ provider, start, finalize, cleanup, timeoutMs = 10 * 60 * 1000 }) {
    const token = crypto.randomBytes(8).toString('hex');
    const entry = { token, provider, status: 'waiting', message: 'Finish signing in from your browser.', url: null, result: null, startedAt: Date.now(), child: null, cleanup };
    this.items.set(token, entry);
    let timer = null;

    const settle = (status, message, result) => {
      if (entry.status !== 'waiting') return;
      entry.status = status;
      entry.message = message;
      entry.result = result || null;
      clearTimeout(timer);
      try { if (cleanup) cleanup(); } catch (_) {}
      setTimeout(() => this.items.delete(token), KEEP_MS).unref();
    };

    let child;
    try {
      child = start();
    } catch (err) {
      settle('failed', `Couldn't start the sign-in: ${err.message}`);
      return token;
    }
    entry.child = child;
    timer = setTimeout(() => {
      try { child.kill(); } catch (_) {}
      settle('failed', 'Sign-in timed out. Try again.');
    }, timeoutMs);
    timer.unref();

    const onData = (chunk) => {
      const match = URL_PATTERN.exec(String(chunk));
      if (match && !entry.url) entry.url = match[0];
    };
    if (child.stdout) child.stdout.on('data', onData);
    if (child.stderr) child.stderr.on('data', onData);
    child.on('error', (err) => settle('failed', `Couldn't start the sign-in: ${err.message}`));
    child.on('close', (code) => {
      if (entry.status !== 'waiting') return;
      if (code !== 0) return settle('failed', 'Sign-in was not completed.');
      try {
        settle('done', 'Account added.', finalize());
      } catch (err) {
        settle('failed', err.message);
      }
    });
    return token;
  }

  view(entry) {
    return { token: entry.token, provider: entry.provider, status: entry.status, message: entry.message, url: entry.url, result: entry.result, startedAt: entry.startedAt };
  }

  get(token) {
    const entry = this.items.get(token);
    return entry ? this.view(entry) : null;
  }

  list(provider) {
    return [...this.items.values()].filter((e) => e.provider === provider).map((e) => this.view(e));
  }

  cancel(token) {
    const entry = this.items.get(token);
    if (!entry) return false;
    if (entry.status === 'waiting') {
      try { entry.child.kill(); } catch (_) {}
      entry.status = 'cancelled';
      try { if (entry.cleanup) entry.cleanup(); } catch (_) {}
    }
    this.items.delete(token);
    return true;
  }
}

module.exports = { PendingLogins };
