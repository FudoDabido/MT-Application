'use strict';
const db = require('../db/database');

// POST /api/work-sessions  — log a completed session
function logSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { started_at, ended_at, duration_seconds } = req.body;
    if (!started_at || !ended_at || !duration_seconds) {
      return res.status(400).json({ error: 'started_at, ended_at, duration_seconds required' });
    }
    const date = started_at.split('T')[0];
    const result = db.prepare(
      'INSERT INTO work_sessions (user_id, started_at, ended_at, duration_seconds, date) VALUES (?,?,?,?,?)'
    ).run(userId, started_at, ended_at, Math.round(Number(duration_seconds)), date);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) { next(e); }
}

// GET /api/work-sessions?date=YYYY-MM-DD  — fetch sessions for a date (default today)
function getSessions(req, res, next) {
  try {
    const userId = req.user.id;
    const date   = req.query.date || new Date().toISOString().split('T')[0];
    const rows   = db.prepare(
      'SELECT * FROM work_sessions WHERE user_id=? AND date=? ORDER BY started_at ASC'
    ).all(userId, date);
    const totalSecs = rows.reduce((s, r) => s + r.duration_seconds, 0);
    res.json({ sessions: rows, total_seconds: totalSecs, date });
  } catch (e) { next(e); }
}

module.exports = { logSession, getSessions };
