const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../change-requests.json');

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { return []; }
}

function writeLog(entries) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function createRequest(req, res, next) {
  try {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Forbidden' });
    const { message, page } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const entries = readLog();
    const entry = {
      id:        entries.length + 1,
      timestamp: new Date().toISOString(),
      page:      page || '—',
      message:   message.trim(),
      status:    'pending',
    };
    entries.unshift(entry); // newest first
    writeLog(entries);
    res.json({ ok: true, entry });
  } catch (err) { next(err); }
}

function getRequests(req, res, next) {
  try {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Forbidden' });
    res.json({ requests: readLog() });
  } catch (err) { next(err); }
}

module.exports = { createRequest, getRequests };
