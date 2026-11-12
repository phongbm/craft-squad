/**
 * CraftSquad Tool - shared filesystem helpers (zero dependencies).
 * Atomic writes (temp file + rename), restrictive permissions for credential files, id slugs, time formatting.
 */

const fs = require('fs');
const path = require('path');

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: DIR_MODE });
}

/** Lowercase, filesystem-safe slug (keeps @ . _ + -). Used for account ids derived from an email. */
function slugify(value) {
  const slug = String(value || '').trim().toLowerCase().replace(/[^a-z0-9@._+-]+/g, '-').replace(/^[.-]+/, '').replace(/\.{2,}/g, '.').slice(0, 80);
  if (!slug) throw new Error('Cannot derive an id from an empty value.');
  return slug;
}

function renameReplace(tmpPath, filePath) {
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Windows cannot rename over an existing file in some cases.
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
  }
}

function tmpName(file) {
  return path.join(path.dirname(file), `${path.basename(file)}.tmp.${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
}

function atomicWriteJson(filePath, data, indent = 2, mode = FILE_MODE) {
  ensureDir(path.dirname(filePath));
  const tmpPath = tmpName(filePath);
  const fd = fs.openSync(tmpPath, 'w', mode);
  try {
    fs.writeSync(fd, JSON.stringify(data, null, indent) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  renameReplace(tmpPath, filePath);
}

function atomicCopyFile(src, dest, mode = FILE_MODE) {
  ensureDir(path.dirname(dest));
  const tmpDest = tmpName(dest);
  fs.copyFileSync(src, tmpDest);
  try { fs.chmodSync(tmpDest, mode); } catch (_) {}
  renameReplace(tmpDest, dest);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function formatTimeLeft(diffSec) {
  if (diffSec <= 0) return 'Expired';
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

module.exports = { FILE_MODE, DIR_MODE, ensureDir, slugify, atomicWriteJson, atomicCopyFile, readJson, formatTimeLeft };
