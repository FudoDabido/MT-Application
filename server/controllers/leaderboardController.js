const db = require('../db/database');

function getLeaderboard(req, res, next) {
  try {
    const today = new Date().toISOString().split('T')[0];

    let rows = db.prepare(`
      SELECT u.id, u.name, u.photo_path,
        COALESCE(SUM(
          CASE WHEN et.category = 'strength'
               THEN COALESCE(pr.best_reps, 0) * COALESCE(pr.best_weight_kg, 1)
               ELSE COALESCE(pr.best_distance_km, 0) * 10 + COALESCE(pr.best_duration_secs, 0) / 60.0
          END
        ), 0) as score,
        COUNT(pr.id) as records_count,
        pa.started_at
      FROM users u
      LEFT JOIN personal_records pr ON pr.user_id = u.id
      LEFT JOIN exercise_types et ON et.id = pr.exercise_type_id
      LEFT JOIN program_attempts pa ON pa.user_id = u.id AND pa.status = 'active'
      GROUP BY u.id
      ORDER BY score DESC
      LIMIT 10
    `).all();

    rows = rows.map(r => {
      let program_day = null;
      if (r.started_at) {
        const startDate = r.started_at.split(' ')[0];
        program_day = Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1;
        program_day = Math.min(Math.max(program_day, 1), 60);
      }
      return { ...r, program_day };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

function getUserStats(req, res, next) {
  try {
    const userId = parseInt(req.params.userId, 10);
    const today = new Date().toISOString().split('T')[0];

    const records = db.prepare(`
      SELECT pr.*, et.name as exercise_name, et.category
      FROM personal_records pr
      JOIN exercise_types et ON et.id = pr.exercise_type_id
      WHERE pr.user_id = ?
      ORDER BY et.name ASC
    `).all(userId);

    const checkinStats = db.prepare(`
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'missed' OR (checked_in_at IS NULL AND date < date('now')) THEN 1 ELSE 0 END) as fails,
        SUM(COALESCE(late_checkin, 0)) as late_training
      FROM training_checkins
      WHERE user_id = ?
    `).get(userId);

    const wakeStats = db.prepare(`
      SELECT SUM(COALESCE(late_wakeup, 0)) as late_wake
      FROM wake_presence
      WHERE user_id = ?
    `).get(userId);

    const exerciseCount = db.prepare(`
      SELECT COUNT(*) as total_exercises
      FROM training_exercise_logs
      WHERE user_id = ?
    `).get(userId);

    const attempt = db.prepare(`
      SELECT started_at FROM program_attempts
      WHERE user_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `).get(userId);

    let program_day = null;
    if (attempt && attempt.started_at) {
      const startDate = attempt.started_at.split(' ')[0];
      program_day = Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1;
      program_day = Math.min(Math.max(program_day, 1), 60);
    }

    const user = db.prepare('SELECT id, name, photo_path FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user,
      records,
      program_day,
      stats: {
        total_days:      checkinStats.total_days      || 0,
        completed:       checkinStats.completed       || 0,
        fails:           checkinStats.fails           || 0,
        late_training:   checkinStats.late_training   || 0,
        late_wake:       wakeStats.late_wake          || 0,
        total_exercises: exerciseCount.total_exercises || 0,
        records_count:   records.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLeaderboard, getUserStats };
