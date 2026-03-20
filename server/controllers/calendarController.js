const db = require('../db/database');

function getMonth(req, res, next) {
  try {
    const userId = req.user.id;
    const { yearMonth } = req.params; // YYYY-MM

    const rows = db.prepare(`
      SELECT
        date(logged_at) as day,
        COUNT(*) as log_count,
        GROUP_CONCAT(DISTINCT et.muscle_group) as muscle_groups,
        SUM(COALESCE(wl.sets,1) * COALESCE(wl.reps,0)) as strength_volume,
        SUM(COALESCE(wl.distance_km,0)) as total_distance_km,
        SUM(COALESCE(wl.duration_secs,0)) as total_duration_secs,
        MIN(wl.logged_at) as first_log,
        MAX(wl.logged_at) as last_log
      FROM workout_logs wl
      JOIN exercise_types et ON et.id = wl.exercise_type_id
      WHERE wl.user_id=? AND strftime('%Y-%m', wl.logged_at)=?
      GROUP BY date(logged_at)
      ORDER BY day ASC
    `).all(userId, yearMonth);

    // Get daily stats (wake time)
    const stats = db.prepare(`SELECT * FROM daily_stats WHERE user_id=? AND strftime('%Y-%m', date)=?`).all(userId, yearMonth);
    const statsMap = {};
    stats.forEach(s => { statsMap[s.date] = s; });

    const result = rows.map(r => ({
      ...r,
      total_load: Math.round((r.strength_volume || 0) + (r.total_distance_km || 0) * 50 + (r.total_duration_secs || 0) / 10),
      wake_time: statsMap[r.day]?.wake_time || null,
      notes: statsMap[r.day]?.notes || null
    }));

    res.json(result);
  } catch(err) { next(err); }
}

function getDay(req, res, next) {
  try {
    const userId = req.user.id;
    const { date } = req.params; // YYYY-MM-DD

    const logs = db.prepare(`
      SELECT wl.*, et.name as exercise_name, et.category, et.muscle_group, et.secondary_muscles, et.met_value
      FROM workout_logs wl
      JOIN exercise_types et ON et.id = wl.exercise_type_id
      WHERE wl.user_id=? AND date(wl.logged_at)=?
      ORDER BY wl.logged_at ASC
    `).all(userId, date);

    const dailyStat = db.prepare(`SELECT * FROM daily_stats WHERE user_id=? AND date=?`).get(userId, date);

    // Muscle group breakdown
    const muscleBreakdown = {};
    logs.forEach(log => {
      const mg = log.muscle_group || 'other';
      if (!muscleBreakdown[mg]) muscleBreakdown[mg] = 0;
      muscleBreakdown[mg] += (log.sets || 1) * (log.reps || 0);
      if (log.secondary_muscles) {
        log.secondary_muscles.split(',').forEach(sm => {
          const s = sm.trim();
          if (s) { if (!muscleBreakdown[s]) muscleBreakdown[s] = 0; muscleBreakdown[s] += Math.round((log.sets || 1) * (log.reps || 0) * 0.4); }
        });
      }
    });

    const totalLoad = logs.reduce((sum, log) => {
      return sum + (log.sets || 1) * (log.reps || 0) + (log.distance_km || 0) * 50 + (log.duration_secs || 0) / 10;
    }, 0);

    res.json({
      date,
      logs,
      wake_time: dailyStat?.wake_time || null,
      notes: dailyStat?.notes || null,
      first_log: logs.length ? logs[0].logged_at : null,
      last_log: logs.length ? logs[logs.length - 1].logged_at : null,
      total_load: Math.round(totalLoad),
      muscle_breakdown: muscleBreakdown,
      total_exercises: logs.length
    });
  } catch(err) { next(err); }
}

module.exports = { getMonth, getDay };
