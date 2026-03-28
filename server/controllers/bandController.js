const db = require('../db/database');

function getSummary(req, res, next) {
  try {
    const uid = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const latest_hr     = db.prepare(`SELECT bpm, recorded_at, context FROM hr_readings WHERE user_id=? ORDER BY recorded_at DESC LIMIT 1`).get(uid);
    const latest_spo2   = db.prepare(`SELECT spo2_pct, recorded_at FROM spo2_readings WHERE user_id=? ORDER BY recorded_at DESC LIMIT 1`).get(uid);
    const latest_stress = db.prepare(`SELECT stress_score, hrv_ms, recorded_at FROM stress_readings WHERE user_id=? ORDER BY recorded_at DESC LIMIT 1`).get(uid);
    const latest_sleep  = db.prepare(`SELECT date, total_mins, deep_mins, quality_score FROM sleep_sessions WHERE user_id=? ORDER BY date DESC LIMIT 1`).get(uid);
    const today_activity= db.prepare(`SELECT steps, calories_kcal, active_mins, distance_km FROM daily_activity WHERE user_id=? AND date=?`).get(uid, today);
    const latest_vo2    = db.prepare(`SELECT vo2_max, date FROM training_fitness_metrics WHERE user_id=? AND vo2_max IS NOT NULL ORDER BY date DESC LIMIT 1`).get(uid);
    const last_sync     = db.prepare(`SELECT synced_at, battery_pct, device_id FROM band_sync_log WHERE user_id=? ORDER BY synced_at DESC LIMIT 1`).get(uid);

    const has_data = !!(latest_hr || latest_spo2 || latest_stress || latest_sleep || today_activity);

    res.json({ latest_hr, latest_spo2, latest_stress, latest_sleep, today_activity, latest_vo2max: latest_vo2, last_synced: last_sync, has_data });
  } catch(err) { next(err); }
}

function getSleep(req, res, next) {
  try {
    const uid = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const rows = db.prepare(`
      SELECT date, sleep_start, sleep_end, total_mins, deep_mins, light_mins, rem_mins, awake_mins,
             quality_score, breathing_score, apnea_events, respiratory_rate, is_nap, sleep_animal
      FROM sleep_sessions WHERE user_id=? ORDER BY date DESC LIMIT ?
    `).all(uid, days);
    res.json(rows);
  } catch(err) { next(err); }
}

function getHeartRate(req, res, next) {
  try {
    const uid = req.user.id;
    const days = parseInt(req.query.days) || 7;
    const context = req.query.context;
    let q = `SELECT id, recorded_at, bpm, context FROM hr_readings WHERE user_id=? AND recorded_at >= datetime('now', '-${days} days')`;
    const params = [uid];
    if (context) { q += ' AND context=?'; params.push(context); }
    q += ' ORDER BY recorded_at ASC';
    const rows = db.prepare(q).all(...params);
    res.json(rows);
  } catch(err) { next(err); }
}

function getSpo2(req, res, next) {
  try {
    const uid = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const rows = db.prepare(`
      SELECT id, recorded_at, spo2_pct, alert_triggered, context
      FROM spo2_readings WHERE user_id=? AND recorded_at >= datetime('now', '-${days} days')
      ORDER BY recorded_at ASC
    `).all(uid);
    res.json(rows);
  } catch(err) { next(err); }
}

function getStress(req, res, next) {
  try {
    const uid = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const rows = db.prepare(`
      SELECT id, recorded_at, stress_score, hrv_ms
      FROM stress_readings WHERE user_id=? AND recorded_at >= datetime('now', '-${days} days')
      ORDER BY recorded_at ASC
    `).all(uid);
    res.json(rows);
  } catch(err) { next(err); }
}

function getActivity(req, res, next) {
  try {
    const uid = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const rows = db.prepare(`
      SELECT date, steps, distance_km, calories_kcal, standing_mins, active_mins, vitality_points
      FROM daily_activity WHERE user_id=? ORDER BY date DESC LIMIT ?
    `).all(uid, days);
    res.json(rows.reverse());
  } catch(err) { next(err); }
}

function getWorkouts(req, res, next) {
  try {
    const uid = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const rows = db.prepare(`
      SELECT id, sport_type, started_at, ended_at, duration_secs, distance_km, calories_kcal,
             avg_hr, max_hr, min_hr, avg_pace_min_km, avg_speed_kmh, steps,
             aerobic_effect, anaerobic_effect, training_load, recovery_time_mins, notes
      FROM band_workout_sessions WHERE user_id=? AND started_at >= datetime('now', '-${days} days')
      ORDER BY started_at DESC
    `).all(uid);
    res.json(rows);
  } catch(err) { next(err); }
}

function getFitness(req, res, next) {
  try {
    const uid = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const rows = db.prepare(`
      SELECT date, vo2_max, training_load, recovery_time_mins, aerobic_effect, anaerobic_effect
      FROM training_fitness_metrics WHERE user_id=? ORDER BY date DESC LIMIT ?
    `).all(uid, days);
    res.json(rows.reverse());
  } catch(err) { next(err); }
}

function getSyncLog(req, res, next) {
  try {
    const uid = req.user.id;
    const rows = db.prepare(`
      SELECT synced_at, records_hr, records_spo2, records_stress, records_sleep,
             records_activity, records_workouts, device_id, firmware_ver, battery_pct, notes
      FROM band_sync_log WHERE user_id=? ORDER BY synced_at DESC LIMIT 10
    `).all(uid);
    res.json(rows);
  } catch(err) { next(err); }
}

function importData(req, res, next) {
  try {
    const uid = req.user.id;
    const { hr_readings=[], spo2_readings=[], stress_readings=[], skin_temp_readings=[],
            sleep_sessions=[], daily_activity=[], band_workouts=[], fitness_metrics=[], sync_meta={} } = req.body;

    const counts = { hr: 0, spo2: 0, stress: 0, skin_temp: 0, sleep: 0, activity: 0, workouts: 0, fitness: 0 };

    const insHr = db.prepare(`INSERT OR IGNORE INTO hr_readings (user_id, recorded_at, bpm, context, source) VALUES (?,?,?,?,?)`);
    for (const r of hr_readings) {
      const info = insHr.run(uid, r.recorded_at, r.bpm, r.context || 'resting', 'band');
      counts.hr += info.changes;
    }

    const insSpo2 = db.prepare(`INSERT OR IGNORE INTO spo2_readings (user_id, recorded_at, spo2_pct, alert_triggered, context, source) VALUES (?,?,?,?,?,?)`);
    for (const r of spo2_readings) {
      const info = insSpo2.run(uid, r.recorded_at, r.spo2_pct, r.alert_triggered || 0, r.context || 'resting', 'band');
      counts.spo2 += info.changes;
    }

    const insStress = db.prepare(`INSERT OR IGNORE INTO stress_readings (user_id, recorded_at, stress_score, hrv_ms, source) VALUES (?,?,?,?,?)`);
    for (const r of stress_readings) {
      const info = insStress.run(uid, r.recorded_at, r.stress_score, r.hrv_ms || null, 'band');
      counts.stress += info.changes;
    }

    const insTemp = db.prepare(`INSERT OR IGNORE INTO skin_temp_readings (user_id, recorded_at, temp_c, temp_delta_c, source) VALUES (?,?,?,?,?)`);
    for (const r of skin_temp_readings) {
      const info = insTemp.run(uid, r.recorded_at, r.temp_c, r.temp_delta_c || null, 'band');
      counts.skin_temp += info.changes;
    }

    const insSleep = db.prepare(`
      INSERT OR IGNORE INTO sleep_sessions (user_id, date, sleep_start, sleep_end, total_mins, deep_mins, light_mins, rem_mins, awake_mins, quality_score, breathing_score, apnea_events, respiratory_rate, is_nap, source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const r of sleep_sessions) {
      const info = insSleep.run(uid, r.date, r.sleep_start||null, r.sleep_end||null, r.total_mins||null,
        r.deep_mins||null, r.light_mins||null, r.rem_mins||null, r.awake_mins||null,
        r.quality_score||null, r.breathing_score||null, r.apnea_events||0, r.respiratory_rate||null, r.is_nap||0, 'band');
      counts.sleep += info.changes;
    }

    const insActivity = db.prepare(`
      INSERT OR REPLACE INTO daily_activity (user_id, date, steps, distance_km, calories_kcal, standing_mins, active_mins, vitality_points, source)
      VALUES (?,?,?,?,?,?,?,?,?)
    `);
    for (const r of daily_activity) {
      insActivity.run(uid, r.date, r.steps||0, r.distance_km||0, r.calories_kcal||0, r.standing_mins||0, r.active_mins||0, r.vitality_points||0, 'band');
      counts.activity++;
    }

    const insWorkout = db.prepare(`
      INSERT OR IGNORE INTO band_workout_sessions (user_id, sport_type, started_at, ended_at, duration_secs, distance_km, calories_kcal, avg_hr, max_hr, min_hr, avg_pace_min_km, avg_speed_kmh, steps, aerobic_effect, anaerobic_effect, training_load, recovery_time_mins, source, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const r of band_workouts) {
      const info = insWorkout.run(uid, r.sport_type||'other', r.started_at, r.ended_at||null,
        r.duration_secs||null, r.distance_km||null, r.calories_kcal||null,
        r.avg_hr||null, r.max_hr||null, r.min_hr||null, r.avg_pace_min_km||null, r.avg_speed_kmh||null,
        r.steps||null, r.aerobic_effect||null, r.anaerobic_effect||null, r.training_load||null,
        r.recovery_time_mins||null, 'band', r.notes||null);
      counts.workouts += info.changes;
    }

    const insFitness = db.prepare(`
      INSERT OR REPLACE INTO training_fitness_metrics (user_id, date, vo2_max, training_load, recovery_time_mins, aerobic_effect, anaerobic_effect, source)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    for (const r of fitness_metrics) {
      insFitness.run(uid, r.date, r.vo2_max||null, r.training_load||null, r.recovery_time_mins||null, r.aerobic_effect||null, r.anaerobic_effect||null, 'band');
      counts.fitness++;
    }

    // Log the sync
    db.prepare(`
      INSERT INTO band_sync_log (user_id, records_hr, records_spo2, records_stress, records_sleep, records_activity, records_workouts, device_id, firmware_ver, battery_pct)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(uid, counts.hr, counts.spo2, counts.stress, counts.sleep, counts.activity, counts.workouts,
      sync_meta.device_id||null, sync_meta.firmware_ver||null, sync_meta.battery_pct||null);

    res.json({ imported: counts });
  } catch(err) { next(err); }
}

module.exports = { getSummary, getSleep, getHeartRate, getSpo2, getStress, getActivity, getWorkouts, getFitness, getSyncLog, importData };
