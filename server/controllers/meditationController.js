const db = require('../db/database');

function getUserMode(userId) {
  const row = db.prepare(`SELECT meditation_mode FROM users WHERE id=?`).get(userId);
  return row?.meditation_mode || '1h_morning';
}

function getToday(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const mode = getUserMode(userId);

    if (mode === '2x30') {
      const sessions = db.prepare(
        `SELECT * FROM meditation_sessions WHERE user_id=? AND date=? ORDER BY id ASC`
      ).all(userId, today);
      const morning = sessions.find(s => s.slot === 'morning') || null;
      const evening = sessions.find(s => s.slot === 'evening') || null;
      return res.json({ mode, morning_session: morning, evening_session: evening, session: morning });
    }

    const session = db.prepare(
      `SELECT * FROM meditation_sessions WHERE user_id=? AND date=? ORDER BY id DESC LIMIT 1`
    ).get(userId, today);
    res.json({ mode, session: session || null });
  } catch(err) { next(err); }
}

function startSession(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const mode = getUserMode(userId);

    if (mode === '2x30') {
      const { slot } = req.body; // 'morning' or 'evening'
      if (!slot || !['morning', 'evening'].includes(slot)) {
        return res.status(400).json({ error: 'slot required: morning or evening' });
      }
      const existing = db.prepare(
        `SELECT * FROM meditation_sessions WHERE user_id=? AND date=? AND slot=?`
      ).get(userId, today, slot);
      if (existing && existing.status !== 'failed') {
        return res.json({ session: existing });
      }
      const result = db.prepare(
        `INSERT INTO meditation_sessions (user_id, date, started_at, status, duration_mins, slot) VALUES (?, ?, datetime('now'), 'active', 30, ?)`
      ).run(userId, today, slot);
      const session = db.prepare(`SELECT * FROM meditation_sessions WHERE id=?`).get(result.lastInsertRowid);
      return res.status(201).json({ session });
    }

    // 1h_morning: single session
    const existing = db.prepare(
      `SELECT * FROM meditation_sessions WHERE user_id=? AND date=?`
    ).get(userId, today);
    if (existing && existing.status !== 'failed') {
      return res.json({ session: existing });
    }
    const result = db.prepare(
      `INSERT INTO meditation_sessions (user_id, date, started_at, status, duration_mins, slot) VALUES (?, ?, datetime('now'), 'active', 60, 'solo')`
    ).run(userId, today);
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

function getMode(req, res, next) {
  try {
    res.json({ meditation_mode: getUserMode(req.user.id) });
  } catch(err) { next(err); }
}

function setMode(req, res, next) {
  try {
    const { meditation_mode } = req.body;
    if (meditation_mode !== '1h_morning') {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    db.prepare(`UPDATE users SET meditation_mode=? WHERE id=?`).run(meditation_mode, req.user.id);
    res.json({ meditation_mode });
  } catch(err) { next(err); }
}

module.exports = { getToday, startSession, confirmPresence, failSession, getMode, setMode };
