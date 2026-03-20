const db = require('../db/database');

function getToday(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const session = db.prepare(`SELECT * FROM meditation_sessions WHERE user_id=? AND date=? ORDER BY id DESC LIMIT 1`).get(req.user.id, today);
    res.json({ session: session || null });
  } catch(err) { next(err); }
}

function startSession(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    // Only one session per day
    const existing = db.prepare(`SELECT * FROM meditation_sessions WHERE user_id=? AND date=?`).get(userId, today);
    if (existing && existing.status !== 'failed') {
      return res.json({ session: existing });
    }
    const result = db.prepare(`INSERT INTO meditation_sessions (user_id, date, started_at, status, duration_mins) VALUES (?, ?, datetime('now'), 'active', 60)`).run(userId, today);
    const session = db.prepare(`SELECT * FROM meditation_sessions WHERE id=?`).get(result.lastInsertRowid);
    res.status(201).json({ session });
  } catch(err) { next(err); }
}

function confirmPresence(req, res, next) {
  try {
    const { session_id } = req.body;
    const session = db.prepare(`SELECT * FROM meditation_sessions WHERE id=? AND user_id=?`).get(session_id, req.user.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    db.prepare(`UPDATE meditation_sessions SET status='passed', presence_confirmed=1, ended_at=datetime('now') WHERE id=?`).run(session_id);
    const updated = db.prepare(`SELECT * FROM meditation_sessions WHERE id=?`).get(session_id);
    res.json({ session: updated });
  } catch(err) { next(err); }
}

function failSession(req, res, next) {
  try {
    const { session_id } = req.body;
    db.prepare(`UPDATE meditation_sessions SET status='failed', presence_confirmed=0, ended_at=datetime('now') WHERE id=? AND user_id=?`).run(session_id, req.user.id);
    res.json({ success: true });
  } catch(err) { next(err); }
}

module.exports = { getToday, startSession, confirmPresence, failSession };
