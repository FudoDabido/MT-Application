const db = require('../db/database');

function getPending(req, res, next) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const existing = db.prepare('SELECT id FROM monthly_checkins WHERE user_id=? AND year=? AND month=?').get(req.user.id, year, month);
    res.json({ pending: !existing, year, month });
  } catch (err) {
    next(err);
  }
}

function createCheckin(req, res, next) {
  try {
    const { weight_kg, height_cm, year, month } = req.body;
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    const result = db.prepare(`
      INSERT INTO monthly_checkins (user_id, year, month, weight_kg, height_cm)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, year, month) DO UPDATE SET weight_kg=excluded.weight_kg, height_cm=excluded.height_cm, checked_in_at=datetime('now')
    `).run(req.user.id, y, m, weight_kg || null, height_cm || null);
    res.status(201).json({ id: result.lastInsertRowid, year: y, month: m, weight_kg, height_cm });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPending, createCheckin };
