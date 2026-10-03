const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionDir(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) return null;
  return path.join(
    os.homedir(),
    '.supermemory-claude',
    'statusline',
    'statusline-state',
    crypto.createHash('sha256').update(sessionId.trim()).digest('hex'),
  );
}

function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {}
  const temporary = path.join(
    dir,
    `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );

  try {
    fs.writeFileSync(temporary, JSON.stringify(value), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    fs.renameSync(temporary, file);
    try {
      fs.chmodSync(file, 0o600);
    } catch {}
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch {}
  }
}

function pruneState() {
  const root = path.join(
    os.homedir(),
    '.supermemory-claude',
    'statusline',
    'statusline-state',
  );
  const cutoff = Date.now() - SESSION_RETENTION_MS;

  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
      const sessionDir = path.join(root, entry.name);
      let newest = 0;
      try {
        newest = fs.statSync(sessionDir).mtimeMs;
        for (const file of fs.readdirSync(sessionDir)) {
          newest = Math.max(
            newest,
            fs.statSync(path.join(sessionDir, file)).mtimeMs,
          );
        }
      } catch {
        continue;
      }
      if (newest < cutoff)
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch {}
}

module.exports = { atomicWriteJson, getSessionDir, pruneState };
