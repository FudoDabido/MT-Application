const db = require('../db/database');
const { updatePR } = require('../services/recordsService');

function createLog(req, res, next) {
  try {
    const userId = req.user.id;
    const { exercise_type_id, sets, reps, distance_km, duration_secs, notes, logged_at } = req.body;
    if (!exercise_type_id) return res.status(400).json({ error: 'exercise_type_id required' });
    const videoPath = req.file ? `uploads/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO workout_logs (user_id, exercise_type_id, logged_at, sets, reps, distance_km, duration_secs, video_path, notes)
      VALUES (?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?, ?, ?)
    `).run(userId, exercise_type_id, logged_at || null, sets || null, reps || null, distance_km || null, duration_secs || null, videoPath, notes || null);

    const log = db.prepare('SELECT * FROM workout_logs WHERE id=?').get(result.lastInsertRowid);
    updatePR(userId, exercise_type_id, log);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}

function getLogs(req, res, next) {
  try {
    const { exercise_type_id, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT wl.*, et.name as exercise_name FROM workout_logs wl JOIN exercise_types et ON et.id=wl.exercise_type_id WHERE wl.user_id=?';
    const params = [req.user.id];
    if (exercise_type_id) { query += ' AND wl.exercise_type_id=?'; params.push(exercise_type_id); }
    query += ' ORDER BY wl.logged_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    next(err);
  }
}

function getTodaySummary(req, res, next) {
  try {
    const rows = db.prepare(`
      SELECT et.name, et.category, COUNT(*) as log_count,
        SUM(wl.sets) as total_sets, SUM(wl.reps) as total_reps,
        SUM(wl.distance_km) as total_distance_km, SUM(wl.duration_secs) as total_duration_secs
      FROM workout_logs wl JOIN exercise_types et ON et.id=wl.exercise_type_id
      WHERE wl.user_id=? AND date(wl.logged_at)=date('now')
      GROUP BY et.id
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

function getWeeklySummary(req, res, next) {
  try {
    const rows = db.prepare(`
      SELECT date(logged_at) as day, COUNT(*) as log_count,
        SUM(reps) as total_reps, SUM(sets) as total_sets,
        SUM(distance_km) as total_distance_km, SUM(duration_secs) as total_duration_secs
      FROM workout_logs WHERE user_id=? AND logged_at >= datetime('now', '-7 days')
      GROUP BY date(logged_at) ORDER BY day ASC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

function getConsistency(req, res, next) {
  try {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const row = db.prepare(`
      SELECT COUNT(DISTINCT date(logged_at)) as days_trained
      FROM workout_logs WHERE user_id=? AND strftime('%Y-%m', logged_at)=?
    `).get(req.user.id, yearMonth);
    const daysElapsed = now.getDate();
    res.json({ days_trained: row.days_trained, days_elapsed: daysElapsed, year_month: yearMonth });
  } catch (err) {
    next(err);
  }
}

module.exports = { createLog, getLogs, getTodaySummary, getWeeklySummary, getConsistency };
