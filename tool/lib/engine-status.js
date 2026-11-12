/**
 * CraftSquad Tool - engine CLI availability. Probes run asynchronously and are cached so polling never blocks the server.
 */

const { codexVersion } = require('./codex/runtime');
const { claudeVersion } = require('./claude/runtime');

const TTL_MS = 60 * 1000;
let cache = { at: 0, value: null, inflight: null };

async function probe() {
  const [codex, claude] = await Promise.all([codexVersion(), claudeVersion()]);
  return {
    codex: { installed: Boolean(codex), version: codex },
    claude: { installed: Boolean(claude), version: claude }
  };
}

async function getEngineStatus({ force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  if (!cache.inflight) {
    cache.inflight = probe().then((value) => {
      cache = { at: Date.now(), value, inflight: null };
      return value;
    }, (err) => {
      cache.inflight = null;
      throw err;
    });
  }
  return cache.inflight;
}

module.exports = { getEngineStatus };
