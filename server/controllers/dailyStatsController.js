const db = require('../db/database');

function getDailyStats(req, res, next) {
  try {
    const row = db.prepare(`SELECT * FROM daily_stats WHERE user_id=? AND date=?`).get(req.user.id, req.params.date);
    res.json(row || { date: req.params.date, wake_time: null, notes: null });
  } catch(err) { next(err); }
}

function upsertDailyStats(req, res, next) {
  try {
    const { date, wake_time, notes } = req.body;
    db.prepare(`
      INSERT INTO daily_stats (user_id, date, wake_time, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET wake_time=excluded.wake_time, notes=excluded.notes
    `).run(req.user.id, date, wake_time || null, notes || null);
    res.json({ success: true });
  } catch(err) { next(err); }
}

module.exports = { getDailyStats, upsertDailyStats };
