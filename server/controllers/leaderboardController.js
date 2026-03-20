const db = require('../db/database');

function getLeaderboard(req, res, next) {
  try {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rows = db.prepare(`
      SELECT u.id, u.name, u.photo_path,
        COUNT(DISTINCT date(wl.logged_at)) as days_active,
        COUNT(wl.id) as total_logs,
        SUM(wl.reps) as total_reps
      FROM users u
      LEFT JOIN workout_logs wl ON wl.user_id=u.id AND strftime('%Y-%m', wl.logged_at)=?
      GROUP BY u.id ORDER BY days_active DESC, total_logs DESC LIMIT 20
    `).all(yearMonth);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getLeaderboard };
