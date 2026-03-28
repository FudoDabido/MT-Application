const db = require('../db/database');
const { generatePhases, getTodayPlan } = require('../services/programGeneratorService');

// ── Unified "did workout happen on this date" check ───────────────────────────
// Checks BOTH workout_logs (free logging) AND training_checkins (program check-in)
function hasWorkoutOnDate(userId, dateStr) {
  const inLogs = db.prepare(
    `SELECT 1 FROM workout_logs WHERE user_id=? AND date(logged_at)=? LIMIT 1`
  ).get(userId, dateStr);
  if (inLogs) return true;
  const inCheckins = db.prepare(
    `SELECT 1 FROM training_checkins WHERE user_id=? AND date=? AND status='completed' LIMIT 1`
  ).get(userId, dateStr);
  return !!inCheckins;
}

function getActiveAttempt(userId) {
  return db.prepare(`SELECT * FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`).get(userId);
}

function checkForFailure(attempt, userId) {
  if (!attempt) return null;
  const startDate = attempt.started_at.split(' ')[0];
  const today = new Date().toISOString().split('T')[0];
  const start = new Date(startDate);
  const todayDate = new Date(today);
  const daysSinceStart = Math.floor((todayDate - start) / 86400000);

  for (let d = 0; d < daysSinceStart; d++) {
    const checkDate = new Date(start.getTime() + d * 86400000);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (!hasWorkoutOnDate(userId, dateStr)) {
      db.prepare(`UPDATE program_attempts SET status='failed', ended_at=datetime('now') WHERE id=?`).run(attempt.id);
      return { failed: true, failedOnDay: d + 1, failedDate: dateStr };
    }
  }
  return null;
}

function getStatus(req, res, next) {
  try {
    const userId = req.user.id;
    let attempt = getActiveAttempt(userId);
    let failure = null;

    if (attempt) {
      failure = checkForFailure(attempt, userId);
      if (failure) attempt = null;
    }

    if (!attempt) {
      const totalTries = db.prepare(`SELECT COUNT(*) as cnt FROM program_attempts WHERE user_id=?`).get(userId);
      return res.json({ active: false, failure, try_number: totalTries.cnt, total_tries: totalTries.cnt });
    }

    const startDate = attempt.started_at.split(' ')[0];
    const today = new Date().toISOString().split('T')[0];

    const startsTomorrow = startDate > today;

    // Count completed days from BOTH tables
    const completedRows = db.prepare(`
      SELECT COUNT(*) as cnt FROM (
        SELECT date(logged_at) as d FROM workout_logs
          WHERE user_id=? AND date(logged_at) >= ? AND date(logged_at) <= ?
        UNION
        SELECT date as d FROM training_checkins
          WHERE user_id=? AND date >= ? AND date <= ? AND status='completed'
      ) t
    `).get(userId, startDate, today, userId, startDate, today);

    const completedDays = completedRows.cnt || 0;
    const todayDone = hasWorkoutOnDate(userId, today);
    const currentDay = startsTomorrow ? 0 : Math.min(completedDays + (todayDone ? 0 : 1), 60);

    const todayPlan = getTodayPlan(userId, attempt.id);
    const setup = db.prepare('SELECT * FROM program_setup WHERE attempt_id=? AND user_id=?').get(attempt.id, userId);

    // Use stored times from program_setup so Schedule and Training pages stay in sync
    const schedule = setup ? {
      work_leave_time:   setup.work_leave_time,
      wake_time:         setup.wake_time,
      cold_plunge_time:  setup.cold_plunge_time,
      train_time:        setup.train_time,
      shower_time:       setup.shower_time,
      bedtime:           setup.bedtime,
      return_time:       setup.return_time,
      stretch_time:      setup.stretch_time,
     } : null;

    res.json({
      active: true,
      starts_tomorrow: startsTomorrow,
      start_date: startDate,
      try_number: attempt.try_number,
      total_tries: attempt.try_number,
      started_at: attempt.started_at,
      current_day: currentDay,
      completed_days: completedDays,
      today_done: !!todayDone,
      finished: completedDays >= 60,
      today_plan: todayPlan,
      has_setup: !!setup,
      schedule,
    });
  } catch(err) { next(err); }
}

function generatePreview(req, res, next) {
  try {
    const phases = generatePhases(req.user.id);
    res.json({ phases });
  } catch(err) { next(err); }
}

// ── Time helpers ────────────────────────────────────────────────────────────
function addMins(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function calcSchedule(leaveTime, returnTime, meditationMode = '1h_morning') {
  if (!leaveTime) return {};

  // Fixed morning routine
  const wake          = '05:05';
  const cold_plunge   = '05:10';
  const train         = '05:20';
  const shower        = '06:20';
  const meditate_time = '06:35';
  const bedtime       = addMins(wake, -(8 * 60)); // 21:05

  // Evening block
  let stretch_time, meditate_eve_time;
  if (meditationMode === '2x30') {
    stretch_time      = addMins(bedtime, -75);
    meditate_eve_time = addMins(bedtime, -45);
  } else {
    stretch_time      = addMins(bedtime, -45);
    meditate_eve_time = null;
  }

  return { wake_time: wake, cold_plunge_time: cold_plunge, train_time: train, shower_time: shower,
           bedtime, stretch_time };
}

function setupProgram(req, res, next) {
  try {
    const userId = req.user.id;
    const { start_weight, start_height, work_leave_time, return_time } = req.body;

    db.prepare(`UPDATE program_attempts SET status='abandoned', ended_at=datetime('now') WHERE user_id=? AND status='active'`).run(userId);

    const prev = db.prepare(`SELECT COUNT(*) as cnt FROM program_attempts WHERE user_id=?`).get(userId);
    const tryNum = (prev.cnt || 0) + 1;

    const attemptResult = db.prepare(`INSERT INTO program_attempts (user_id, try_number, started_at, status) VALUES (?, ?, date('now', '+1 day'), 'active')`).run(userId, tryNum);
    const attemptId = attemptResult.lastInsertRowid;

    const phases = generatePhases(userId);

    const userRow = db.prepare(`SELECT meditation_mode FROM users WHERE id=?`).get(userId);
    const sched = calcSchedule(work_leave_time, return_time, userRow?.meditation_mode || '1h_morning');

    db.prepare(`
      INSERT INTO program_setup
        (attempt_id, user_id, start_weight, start_height, phases_json,
         work_leave_time, wake_time, cold_plunge_time, train_time, shower_time, bedtime,
         return_time, stretch_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attemptId, userId, start_weight || null, start_height || null, JSON.stringify(phases),
      work_leave_time || null,
      sched.wake_time || null, sched.cold_plunge_time || null, sched.train_time || null,
      sched.shower_time || null,
      sched.bedtime || null,
      return_time || null,
      sched.stretch_time || null,
    );

    if (start_weight || start_height) {
      db.prepare(`UPDATE users SET initial_weight=COALESCE(?,initial_weight), initial_height=COALESCE(?,initial_height), updated_at=datetime('now') WHERE id=?`)
        .run(start_weight || null, start_height || null, userId);
    }

    res.json({ success: true, try_number: tryNum, attempt_id: attemptId, phases });
  } catch(err) { next(err); }
}

function getGrid(req, res, next) {
  try {
    const userId = req.user.id;
    const attempt = getActiveAttempt(userId);
    if (!attempt) return res.json({ grid: [], active: false });

    checkForFailure(attempt, userId);
    const freshAttempt = getActiveAttempt(userId);
    if (!freshAttempt) return res.json({ grid: [], active: false });

    const startDate = freshAttempt.started_at.split(' ')[0];
    const start = new Date(startDate);
    const today = new Date().toISOString().split('T')[0];
    const grid = [];

    const setup = db.prepare('SELECT phases_json FROM program_setup WHERE attempt_id=?').get(freshAttempt.id);
    const phases = setup ? JSON.parse(setup.phases_json) : [];

    for (let d = 0; d < 60; d++) {
      const dayDate = new Date(start.getTime() + d * 86400000);
      const dateStr = dayDate.toISOString().split('T')[0];
      const dayNum = d + 1;
      const phase = phases.find(p => dayNum >= p.day_start && dayNum <= p.day_end);
      const dayInPhase = phase ? dayNum - phase.day_start + 1 : 0;
      const weekInPhase = dayInPhase <= 7 ? 1 : 2;
      const targetReps = weekInPhase === 1 ? 100 : 150;

      let status = 'future';
      if (dateStr < today) {
        status = hasWorkoutOnDate(userId, dateStr) ? 'completed' : 'missed';
      } else if (dateStr === today) {
        status = hasWorkoutOnDate(userId, today) ? 'completed' : 'today';
      }

      const weekPosG = ((dayNum - 1) % 7) + 1;
      const dayTypeG = weekPosG === 7 ? 'recovery_run' : (weekPosG % 2 === 0 ? 'running' : 'strength');
      grid.push({
        day: dayNum,
        date: dateStr,
        status,
        day_type: dayTypeG,
        phase: phase ? phase.phase : null,
        target_reps: targetReps,
        exercises: phase ? phase.exercises : []
      });
    }

    res.json({ grid, active: true, try_number: freshAttempt.try_number, started_at: freshAttempt.started_at });
  } catch(err) { next(err); }
}

function getToday(req, res, next) {
  try {
    const attempt = getActiveAttempt(req.user.id);
    if (!attempt) return res.json({ active: false });
    const plan = getTodayPlan(req.user.id, attempt.id);
    res.json(plan || { active: false });
  } catch(err) { next(err); }
}

function resetProgram(req, res, next) {
  try {
    const userId = req.user.id;
    db.prepare(`UPDATE program_attempts SET status='abandoned', ended_at=datetime('now') WHERE user_id=? AND status='active'`).run(userId);
    res.json({ success: true, message: 'Program reset. You can now start fresh.' });
  } catch(err) { next(err); }
}

function logDay(req, res, next) {
  try {
    const userId = req.user.id;
    const { exercises } = req.body;

    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'exercises array required' });
    }

    const attempt = getActiveAttempt(userId);
    if (!attempt) return res.status(404).json({ error: 'No active program' });

    for (const ex of exercises) {
      if (!ex.exercise_type_id) continue;
      const notes = ex.succeeded === false ? 'failed' : 'succeeded';
      db.prepare(`
        INSERT INTO workout_logs (user_id, exercise_type_id, reps, notes, logged_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(userId, ex.exercise_type_id, ex.reps_done || null, notes);
    }

    res.json({ success: true });
  } catch(err) { next(err); }
}

module.exports = { getStatus, generatePreview, setupProgram, getGrid, getToday, resetProgram, logDay };
