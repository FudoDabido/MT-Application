const db = require('../db/database');
const { trackLoad } = require('../services/muscleLoadService');
const { completeRun } = require('../services/runningProgressService');
const { getTodayPlan, buildEquipmentKeywords, hasEquipment, PHASE_ROTATION_EXPORT } = require('../services/programGeneratorService');

const WINDOW_MINS = 10;

function isBeforeWindow(scheduledTime) {
  const [sh, sm] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const windowStart = new Date(now); windowStart.setHours(sh, sm, 0, 0);
  return now < windowStart;
}

function isWithinWindow(scheduledTime) {
  const [sh, sm] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const windowStart = new Date(now); windowStart.setHours(sh, sm, 0, 0);
  const windowEnd   = new Date(now); windowEnd.setHours(sh, sm + WINDOW_MINS, 0, 0);
  return now >= windowStart && now <= windowEnd;
}

function windowPassed(scheduledTime) {
  const [sh, sm] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const windowEnd = new Date(now); windowEnd.setHours(sh, sm + WINDOW_MINS, 0, 0);
  return now > windowEnd;
}

function getActiveAttempt(userId) {
  return db.prepare(
    `SELECT pa.id, ps.train_time FROM program_attempts pa
     JOIN program_setup ps ON ps.attempt_id = pa.id
     WHERE pa.user_id=? AND pa.status='active'
     ORDER BY pa.id DESC LIMIT 1`
  ).get(userId);
}

function getToday(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const attempt = getActiveAttempt(userId);
    if (!attempt || !attempt.train_time) {
      return res.json({ checkin: null, train_time: null, plan: null, exercise_logs: [] });
    }

    const trainTime = attempt.train_time;

    // Always check if the program has started yet — ignore any stale checkins from old attempts
    const attemptRow = db.prepare('SELECT started_at FROM program_attempts WHERE id=?').get(attempt.id);
    const startDate = attemptRow?.started_at?.split(' ')[0];
    if (startDate && today < startDate) {
      // Program hasn't started — show "starts tomorrow" state with day 1 exercises
      let plan = null;
      try { plan = getTodayPlan(userId, attempt.id, startDate); } catch {}
      return res.json({ checkin: null, train_time: trainTime, plan, exercise_logs: [], starts_on: startDate });
    }

    db.prepare(`
      INSERT OR IGNORE INTO training_checkins (user_id, date, scheduled_time, status)
      VALUES (?, ?, ?, 'pending')
    `).run(userId, today, trainTime);

    let checkin = db.prepare(`SELECT * FROM training_checkins WHERE user_id=? AND date=?`).get(userId, today);

    // Auto-fail ONLY if it's a new day load and previous day is still pending
    // (we no longer auto-fail within the same day when window closes)
    // Only fail records from a PREVIOUS date that were never completed
    db.prepare(`
      UPDATE training_checkins SET status='failed'
      WHERE user_id=? AND date < ? AND status='pending'
    `).run(userId, today);

    const exerciseLogs = db.prepare(
      `SELECT * FROM training_exercise_logs WHERE checkin_id=? ORDER BY logged_at ASC`
    ).all(checkin.id);

    let plan = null;
    try {
      if (attempt) {
        plan = getTodayPlan(userId, attempt.id);
        if (!plan && startDate) plan = getTodayPlan(userId, attempt.id, startDate);
      }
    } catch (e) { plan = null; }

    // A1: attach last_session to each plan exercise
    if (plan?.exercises?.length) {
      plan.exercises = plan.exercises.map(ex => {
        const last = db.prepare(`
          SELECT tel.reps_done, tel.weight_kg, tc.date
          FROM training_exercise_logs tel
          JOIN training_checkins tc ON tc.id = tel.checkin_id
          WHERE tel.user_id=? AND tel.exercise_type_id=? AND tc.status='completed' AND tc.date < date('now')
          ORDER BY tc.date DESC, tel.logged_at DESC LIMIT 1
        `).get(userId, ex.id);
        return { ...ex, last_session: last || null };
      });
    }

    res.json({ checkin, train_time: trainTime, plan, exercise_logs: exerciseLogs });
  } catch (err) { next(err); }
}

function checkin(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = db.prepare(`SELECT * FROM training_checkins WHERE user_id=? AND date=?`).get(userId, today);
    if (!record) return res.status(404).json({ error: 'No training record for today' });
    if (record.status === 'active')    return res.json({ checkin: record }); // already active
    if (record.status === 'completed') return res.json({ checkin: record });
    if (record.status !== 'pending')   return res.status(409).json({ error: `Status is ${record.status}` });

    // Allow checkin at any time — but flag if late (after window end)
    if (isBeforeWindow(record.scheduled_time)) {
      return res.status(400).json({ error: 'Training window not open yet' });
    }

    const late = windowPassed(record.scheduled_time) ? 1 : 0;
    const { energy_rating } = req.body;

    db.prepare(`
      UPDATE training_checkins SET status='active', checked_in_at=datetime('now'), late_checkin=?, energy_rating=?
      WHERE id=?
    `).run(late, energy_rating || null, record.id);

    const updated = db.prepare(`SELECT * FROM training_checkins WHERE id=?`).get(record.id);
    res.json({ checkin: updated });
  } catch (err) { next(err); }
}

function logExercise(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const checkin = db.prepare(`SELECT * FROM training_checkins WHERE user_id=? AND date=?`).get(userId, today);
    if (!checkin) return res.status(404).json({ error: 'No training checkin for today' });
    if (checkin.status !== 'active') return res.status(409).json({ error: 'Training is not active' });

    const { exercise_type_id, exercise_name, reps_done, weight_kg } = req.body;
    if (!exercise_type_id || !exercise_name) {
      return res.status(400).json({ error: 'exercise_type_id and exercise_name required' });
    }

    const videoPath = req.file ? req.file.path : null;

    const result = db.prepare(`
      INSERT INTO training_exercise_logs
        (checkin_id, user_id, exercise_type_id, exercise_name, reps_done, weight_kg, video_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      checkin.id, userId, exercise_type_id, exercise_name,
      reps_done || null, weight_kg || null, videoPath
    );

    const log = db.prepare(`SELECT * FROM training_exercise_logs WHERE id=?`).get(result.lastInsertRowid);

    // A2: PR auto-detection
    const repsNum   = reps_done   ? Number(reps_done)   : null;
    const weightNum = weight_kg   ? Number(weight_kg)   : null;
    let newPr = false;
    const existing = db.prepare(`SELECT * FROM personal_records WHERE user_id=? AND exercise_type_id=?`).get(userId, exercise_type_id);
    if (!existing) {
      if (repsNum || weightNum) {
        db.prepare(`INSERT INTO personal_records (user_id, exercise_type_id, best_reps, best_weight_kg, achieved_at) VALUES (?,?,?,?,datetime('now'))`).run(userId, exercise_type_id, repsNum, weightNum);
        newPr = !!(repsNum || weightNum);
      }
    } else {
      const updates = {};
      if (repsNum   && repsNum   > (existing.best_reps       || 0)) { updates.best_reps       = repsNum;   newPr = true; }
      if (weightNum && weightNum > (existing.best_weight_kg  || 0)) { updates.best_weight_kg  = weightNum; newPr = true; }
      if (newPr) {
        db.prepare(`UPDATE personal_records SET best_reps=COALESCE(?,best_reps), best_weight_kg=COALESCE(?,best_weight_kg), achieved_at=datetime('now') WHERE user_id=? AND exercise_type_id=?`)
          .run(updates.best_reps || null, updates.best_weight_kg || null, userId, exercise_type_id);
      }
    }


    // ── Track muscle load for recovery-aware programming ─────────────────────
    const today2 = new Date().toISOString().split('T')[0];
    try { trackLoad(userId, exercise_type_id, reps_done ? Number(reps_done) : 0, weight_kg ? Number(weight_kg) : null, today2); } catch(e) { /* non-critical */ }
    res.json({ log, new_pr: newPr, exercise_name });
  } catch (err) { next(err); }
}

function completeTraining(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const checkin = db.prepare(`SELECT * FROM training_checkins WHERE user_id=? AND date=?`).get(userId, today);
    if (!checkin) return res.status(404).json({ error: 'No training checkin for today' });
    if (checkin.status !== 'active') return res.status(409).json({ error: `Cannot complete — status is ${checkin.status}` });

    db.prepare(`UPDATE training_checkins SET status='completed', completed_at=datetime('now') WHERE id=?`).run(checkin.id);
    const updated = db.prepare(`SELECT * FROM training_checkins WHERE id=?`).get(checkin.id);
    res.json({ checkin: updated });
  } catch (err) { next(err); }
}

function getStats(req, res, next) {
  try {
    const userId = req.user.id;
    const all = db.prepare(`SELECT * FROM training_checkins WHERE user_id=? ORDER BY date DESC`).all(userId);

    const total  = all.length;
    const passed = all.filter(r => r.status === 'completed').length;
    const failed = all.filter(r => r.status === 'failed').length;

    let streak = 0;
    for (const r of all) {
      if (r.status === 'pending') continue;
      if (r.status === 'completed') streak++;
      else break;
    }

    let best = 0, cur = 0;
    for (const r of [...all].reverse()) {
      if (r.status === 'pending') continue;
      if (r.status === 'completed') { cur++; best = Math.max(best, cur); }
      else cur = 0;
    }

    res.json({ total, passed, failed, streak, best_streak: best });
  } catch (err) { next(err); }
}

// GET /training-checkin/tomorrow — tomorrow's plan
function getTomorrow(req, res, next) {
  try {
    const userId = req.user.id;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const attempt = getActiveAttempt(userId);
    if (!attempt) return res.json({ plan: null, train_time: null });

    let plan = null;
    try { plan = getTodayPlan(userId, attempt.id, tomorrow); } catch {}
    res.json({ plan, train_time: attempt.train_time, date: tomorrow });
  } catch (err) { next(err); }
}

// GET /training-checkin/alternatives?slot=push&date=YYYY-MM-DD
function getAlternatives(req, res, next) {
  try {
    const userId = req.user.id;
    const { slot, date } = req.query;
    if (!slot) return res.status(400).json({ error: 'slot required' });

    // Get user's equipment keywords (same logic as generator)
    const userEquip = db.prepare(`
      SELECT ei.* FROM user_equipment ue
      JOIN equipment_items ei ON ei.id = ue.equipment_item_id
      WHERE ue.user_id=?
    `).all(userId);

    const equipKeywords = buildEquipmentKeywords(userEquip);

    // Determine target muscle for this slot in current phase
    const attempt = getActiveAttempt(userId);
    if (!attempt) return res.json({ exercises: [] });

    const setup = db.prepare('SELECT * FROM program_setup WHERE attempt_id=? AND user_id=?').get(attempt.id, userId);
    if (!setup) return res.json({ exercises: [] });

    const phases = JSON.parse(setup.phases_json);
    const targetDate = date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const startDate = db.prepare('SELECT started_at FROM program_attempts WHERE id=?').get(attempt.id).started_at.split(' ')[0];
    const dayNum = Math.floor((new Date(targetDate) - new Date(startDate)) / 86400000) + 1;
    const phase = phases.find(p => dayNum >= p.day_start && dayNum <= p.day_end);
    if (!phase) return res.json({ exercises: [] });

    // Current exercise in this slot
    const currentExId = phase.exercises.find(e => e.slot === slot)?.id;

    // Get all strength exercises that can fit this slot (by muscle group in phase)
    // targetMuscle available if needed for future filtering
    // const targetMuscle = PHASE_ROTATION_EXPORT?.[phase.phase - 1]?.[slot];

    // Fallback: get all available exercises for the slot's exercises in this phase
    const allExercises = db.prepare(
      'SELECT * FROM exercise_types WHERE (is_system=1 OR created_by=?) AND category=\'strength\' AND (is_stretching IS NULL OR is_stretching=0)'
    ).all(userId);

    const available = allExercises.filter(ex =>
      hasEquipment(ex.required_equipment, equipKeywords) &&
      ex.id !== currentExId
    ).map(ex => ({
      id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      required_equipment: ex.required_equipment,
      is_compound: ex.is_compound,
    }));

    res.json({ exercises: available.slice(0, 30), slot, date: targetDate });
  } catch (err) { next(err); }
}

// POST /training-checkin/override
function createOverride(req, res, next) {
  try {
    const userId = req.user.id;
    const { date, slot, exercise_type_id, exercise_name } = req.body;
    if (!date || !slot || !exercise_type_id || !exercise_name) {
      return res.status(400).json({ error: 'date, slot, exercise_type_id, exercise_name required' });
    }
    db.prepare(`
      INSERT INTO day_workout_overrides (user_id, date, slot, exercise_type_id, exercise_name)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date, slot) DO UPDATE SET
        exercise_type_id=excluded.exercise_type_id,
        exercise_name=excluded.exercise_name
    `).run(userId, date, slot, exercise_type_id, exercise_name);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// DELETE /training-checkin/override
function deleteOverride(req, res, next) {
  try {
    const userId = req.user.id;
    const { date, slot } = req.body;
    db.prepare(`DELETE FROM day_workout_overrides WHERE user_id=? AND date=? AND slot=?`).run(userId, date, slot);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function adminResetTimer(req, res, next) {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT is_admin FROM users WHERE id=?').get(userId);
    if (!user?.is_admin) return res.status(403).json({ error: 'Admin only' });
    const today = new Date().toISOString().split('T')[0];
    const c = db.prepare('SELECT * FROM training_checkins WHERE user_id=? AND date=?').get(userId, today);
    if (!c) return res.status(404).json({ error: 'No training session today' });
    if (c.status !== 'active') return res.status(409).json({ error: 'Session is not active' });
    db.prepare(`UPDATE training_checkins SET checked_in_at=datetime('now') WHERE id=?`).run(c.id);
    const updated = db.prepare('SELECT * FROM training_checkins WHERE id=?').get(c.id);
    res.json({ checkin: updated });
  } catch (err) { next(err); }
}

function adminStart(req, res, next) {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT is_admin FROM users WHERE id=?').get(userId);
    if (!user?.is_admin) return res.status(403).json({ error: 'Admin only' });
    const today = new Date().toISOString().split('T')[0];
    const attempt = getActiveAttempt(userId);
    if (!attempt) return res.status(404).json({ error: 'No active program' });

    db.prepare(`INSERT OR IGNORE INTO training_checkins (user_id, date, scheduled_time, status) VALUES (?, ?, ?, 'pending')`).run(userId, today, attempt.train_time);
    let c = db.prepare('SELECT * FROM training_checkins WHERE user_id=? AND date=?').get(userId, today);
    if (c.status === 'completed') return res.json({ checkin: c });
    if (c.status !== 'active') {
      db.prepare(`UPDATE training_checkins SET status='active', checked_in_at=datetime('now') WHERE id=?`).run(c.id);
      c = db.prepare('SELECT * FROM training_checkins WHERE id=?').get(c.id);
    }
    res.json({ checkin: c });
  } catch (err) { next(err); }
}

function failTraining(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const checkin = db.prepare(`SELECT * FROM training_checkins WHERE user_id=? AND date=?`).get(userId, today);
    if (!checkin) return res.status(404).json({ error: 'No training checkin for today' });
    if (checkin.status !== 'active') return res.status(409).json({ error: `Cannot fail — status is ${checkin.status}` });
    db.prepare(`UPDATE training_checkins SET status='failed' WHERE id=?`).run(checkin.id);
    const updated = db.prepare(`SELECT * FROM training_checkins WHERE id=?`).get(checkin.id);
    res.json({ checkin: updated });
  } catch (err) { next(err); }
}


// GET /training-checkin/stretch-recommendations?date=YYYY-MM-DD
function getStretchRecommendations(req, res, next) {
  try {
    const { getStretchRecommendations: getRecs } = require('../services/muscleLoadService');
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const stretches = getRecs(req.user.id, date);
    res.json({ stretches, date });
  } catch (err) { next(err); }
}


// GET /training-checkin/muscle-recovery?date=YYYY-MM-DD
function getMuscleRecovery(req, res, next) {
  try {
    const { getRecoveryStatus } = require('../services/muscleLoadService');
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const recovery = getRecoveryStatus(req.user.id, date);

    // Also pull tomorrow's plan exercises so we can warn about fatigued muscles
    const userId = req.user.id;
    const tomorrow = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];
    const attempt = db.prepare(
      `SELECT pa.id FROM program_attempts pa WHERE pa.user_id=? AND pa.status='active' ORDER BY pa.id DESC LIMIT 1`
    ).get(userId);

    let tomorrowMuscles = [];
    if (attempt) {
      const { getTodayPlan } = require('../services/programGeneratorService');
      try {
        const plan = getTodayPlan(userId, attempt.id, tomorrow);
        tomorrowMuscles = (plan?.exercises || []).map(ex => ex.muscle_group).filter(Boolean);
      } catch {}
    }

    // Add tomorrow warning flag to each muscle
    const result = {};
    for (const [muscle, data] of Object.entries(recovery)) {
      result[muscle] = {
        ...data,
        scheduled_tomorrow: tomorrowMuscles.includes(muscle),
      };
    }

    res.json({ recovery: result, date, tomorrow_muscles: tomorrowMuscles });
  } catch (err) { next(err); }
}


async function logRun(req, res, next) {
  try {
    const userId     = req.user.id;
    const { attempt_id, current_day, actual_distance_km, date } = req.body;
    if (!attempt_id || !current_day) return res.status(400).json({ error: 'attempt_id and current_day required' });

    const dateStr = date || new Date().toISOString().split('T')[0];
    const result  = completeRun(userId, attempt_id, Number(current_day), dateStr, actual_distance_km ? Number(actual_distance_km) : null);

    // Complete training checkin for this run day
    const trainRow = db.prepare(
      'SELECT ps.train_time FROM program_attempts pa JOIN program_setup ps ON ps.attempt_id = pa.id WHERE pa.id=?'
    ).get(attempt_id);
    db.prepare(
      "INSERT OR IGNORE INTO training_checkins (user_id, date, scheduled_time, status) VALUES (?, ?, ?, 'pending')"
    ).run(userId, dateStr, trainRow?.train_time || '07:00');
    db.prepare(
      "UPDATE training_checkins SET status='completed', checked_in_at=COALESCE(checked_in_at, datetime('now')), completed_at=datetime('now') WHERE user_id=? AND date=? AND status != 'completed'"
    ).run(userId, dateStr);

    // Also mark workout as done for today
    const existing = db.prepare('SELECT id FROM workout_logs WHERE user_id=? AND date(logged_at)=?').get(userId, dateStr);
    if (!existing) {
      db.prepare("INSERT INTO workout_logs (user_id, logged_at, session_type) VALUES (?, datetime('now'), 'running')").run(userId);
    }

    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

module.exports = {
  logRun,
  getToday, checkin, logExercise, completeTraining, failTraining, getStats,
  getTomorrow, getAlternatives, createOverride, deleteOverride,
  adminStart, adminResetTimer, getStretchRecommendations, getMuscleRecovery,
};
