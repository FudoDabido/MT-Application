'use strict';
const db = require('../db/database');
const { generatePhases, getTodayPlan, getRunDistance, getRunNumber, getWeekPos, getDayType, getPhase, PHASES } = require('../services/programGeneratorService');

// ─── helpers ─────────────────────────────────────────────────────────────────

function getActiveAttempt(userId) {
  return db.prepare(`SELECT * FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`).get(userId);
}

function getTryNumber(userId) {
  const last = db.prepare(`SELECT MAX(try_number) as n FROM program_attempts WHERE user_id=?`).get(userId);
  return (last?.n || 0) + 1;
}

function getUserEquipment(userId) {
  return db.prepare(`
    SELECT ei.name FROM user_equipment ue
    JOIN equipment_items ei ON ei.id = ue.equipment_item_id
    WHERE ue.user_id=?
  `).all(userId).map(r => r.name);
}

// ─── GET /program/status ──────────────────────────────────────────────────────

function getStatus(req, res, next) {
  try {
    const userId  = req.user.id;
    const attempt = getActiveAttempt(userId);

    if (!attempt) {
      const tryNum = getTryNumber(userId);
      return res.json({ active: false, try_number: tryNum });
    }

    const setup = db.prepare(`SELECT * FROM program_setup WHERE attempt_id=?`).get(attempt.id);
    if (!setup) return res.json({ active: false, try_number: attempt.try_number });

    const startDate     = attempt.started_at.split('T')[0];
    const today         = new Date().toISOString().split('T')[0];
    const diffDays      = Math.round((new Date(today) - new Date(startDate)) / 86400000);
    const startsTomorrow = diffDays === -1;
    const currentDay    = startsTomorrow ? 0 : Math.min(diffDays + 1, 60);

    const phase     = getPhase(currentDay);
    const weekPos   = getWeekPos(currentDay);
    const dayType   = getDayType(weekPos);
    const todayPlan = getTodayPlan(userId, attempt.id);

    // Strike check — look for failed training/runs in last window
    checkForStrikes(userId, attempt);

    res.json({
      active:          true,
      starts_tomorrow: startsTomorrow,
      try_number:      attempt.try_number,
      attempt_id:      attempt.id,
      current_day:     currentDay,
      phase_number: phase?.phase,
      phase_name:   phase?.name,
      target_reps:  phase?.target_reps,
      strikes:      attempt.strikes || 0,
      day_type:     dayType,
      today_plan:   todayPlan,
      start_date:   startDate,
      schedule: {
        wake_time:        setup.wake_time,
        cold_plunge_time: setup.cold_plunge_time,
        train_time:       setup.train_time,
        shower_time:      setup.shower_time,
        stretch_time:     setup.stretch_time,
        bedtime:          setup.bedtime,
        work_leave_time:  setup.work_leave_time,
        return_time:      setup.return_time,
      },
    });
  } catch (e) { next(e); }
}

// ─── Strike logic ─────────────────────────────────────────────────────────────

function checkForStrikes(userId, attempt) {
  // Count failed training_checkins for this attempt not yet counted as strikes
  // Simple approach: strikes = number of failed training_checkins + failed runs in this attempt
  const startDate = attempt.started_at.split('T')[0];
  const today     = new Date().toISOString().split('T')[0];

  const failedTraining = db.prepare(`
    SELECT COUNT(*) as cnt FROM training_checkins
    WHERE user_id=? AND status='failed' AND date >= ? AND date <= ?
  `).get(userId, startDate, today)?.cnt || 0;

  const failedRuns = db.prepare(`
    SELECT COUNT(*) as cnt FROM running_progress
    WHERE user_id=? AND attempt_id=? AND completed_at IS NULL AND target_distance_km > 0
      AND is_recovery_run=0
  `).get(userId, attempt.id)?.cnt || 0;

  // Note: we only update strikes when explicitly recording a new miss (see recordStrike)
  // This function just validates state
}

function recordStrike(userId) {
  const attempt = getActiveAttempt(userId);
  if (!attempt) return;

  const newStrikes = (attempt.strikes || 0) + 1;
  db.prepare(`UPDATE program_attempts SET strikes=? WHERE id=?`).run(newStrikes, attempt.id);

  if (newStrikes >= 3) {
    // Reset program
    db.prepare(`UPDATE program_attempts SET status='failed', ended_at=datetime('now') WHERE id=?`).run(attempt.id);
    const tryNum = attempt.try_number + 1;
    // New attempt starts fresh
    const result = db.prepare(`
      INSERT INTO program_attempts (user_id, try_number, started_at, status, strikes)
      VALUES (?, ?, datetime('now'), 'active', 0)
    `).run(userId, tryNum);

    // Copy the setup to new attempt
    const oldSetup = db.prepare(`SELECT * FROM program_setup WHERE attempt_id=?`).get(attempt.id);
    if (oldSetup) {
      db.prepare(`
        INSERT INTO program_setup
          (attempt_id, user_id, start_weight, start_height, phases_json,
           work_leave_time, wake_time, cold_plunge_time, train_time, shower_time,
           bedtime, return_time, stretch_time)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        result.lastInsertRowid, userId, oldSetup.start_weight, oldSetup.start_height,
        oldSetup.phases_json, oldSetup.work_leave_time, oldSetup.wake_time,
        oldSetup.cold_plunge_time, oldSetup.train_time, oldSetup.shower_time,
        oldSetup.bedtime, oldSetup.return_time, oldSetup.stretch_time
      );
    }
    return { reset: true, try_number: tryNum };
  }
  return { strikes: newStrikes };
}

// ─── GET /program/generate ────────────────────────────────────────────────────

function generatePreview(req, res, next) {
  try {
    const equipment = getUserEquipment(req.user.id);
    const phases = generatePhases(req.user.id, equipment);
    res.json({ phases });
  } catch (e) { next(e); }
}

// ─── POST /program/setup ──────────────────────────────────────────────────────

function setupProgram(req, res, next) {
  try {
    const userId = req.user.id;
    const { work_leave_time, return_time, start_weight, start_height } = req.body;

    // Abandon any active attempt
    db.prepare(`UPDATE program_attempts SET status='abandoned', ended_at=datetime('now') WHERE user_id=? AND status='active'`).run(userId);

    const tryNum = getTryNumber(userId);
    const equipment = getUserEquipment(userId);
    const phases = generatePhases(userId, equipment);

    // Calculate schedule from leave_time
    const sched = calcSchedule(work_leave_time, return_time, userId);

    // Save attempt
    const attempt = db.prepare(`
      INSERT INTO program_attempts (user_id, try_number, started_at, status, strikes)
      VALUES (?, ?, date('now'), 'active', 0)
    `).run(userId, tryNum);

    // Update user measurements
    if (start_weight) db.prepare(`UPDATE users SET initial_weight=? WHERE id=?`).run(start_weight, userId);
    if (start_height) db.prepare(`UPDATE users SET initial_height=? WHERE id=?`).run(start_height, userId);

    db.prepare(`
      INSERT INTO program_setup
        (attempt_id, user_id, start_weight, start_height, phases_json,
         work_leave_time, wake_time, cold_plunge_time, train_time, shower_time,
         bedtime, return_time, stretch_time)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      attempt.lastInsertRowid, userId,
      start_weight || null, start_height || null,
      JSON.stringify(phases),
      sched.work_leave_time, sched.wake_time, sched.cold_plunge_time,
      sched.train_time, sched.shower_time, sched.bedtime,
      sched.return_time, sched.stretch_time
    );

    res.json({ ok: true, try_number: tryNum, schedule: sched });
  } catch (e) { next(e); }
}

// ─── Schedule calculation ─────────────────────────────────────────────────────

function addMins(hhmm, mins) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const nm = ((total % 1440) + 1440) % 1440 % 60;
  return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
}

function calcSchedule(workLeaveTime, returnTime, userId) {
  // Sum custom morning tasks
  const customMorning = db.prepare(
    `SELECT COALESCE(SUM(duration_mins),0) as total FROM custom_tasks WHERE user_id=? AND time_of_day='morning'`
  ).get(userId)?.total || 0;

  // Mandatory morning: cold plunge 10 + training 60 + shower 15 = 85
  const mandatoryMins = 85;
  const totalMorning  = mandatoryMins + customMorning + 15; // 15 min buffer

  // Wake time = leave_time - totalMorning
  const wake_time        = addMins(workLeaveTime, -totalMorning);
  const cold_plunge_time = wake_time;           // right at wake
  const train_time       = addMins(wake_time, 10);
  const shower_time      = addMins(train_time, 60);
  const bedtime          = addMins(wake_time, -(7 * 60)); // 7h before wake = previous night
  const stretch_time     = addMins(bedtime, -65);         // 65 min before bed

  return {
    work_leave_time: workLeaveTime,
    return_time:     returnTime || null,
    wake_time, cold_plunge_time, train_time, shower_time, bedtime, stretch_time,
  };
}

// ─── GET /program/grid ────────────────────────────────────────────────────────

function getGrid(req, res, next) {
  try {
    const userId  = req.user.id;
    const attempt = getActiveAttempt(userId);
    if (!attempt) return res.json({ days: [] });

    const startDate = attempt.started_at.split('T')[0];
    const today     = new Date().toISOString().split('T')[0];

    const completedTraining = new Set(
      db.prepare(`SELECT date FROM training_checkins WHERE user_id=? AND status IN ('completed','passed') AND date >= ?`)
        .all(userId, startDate).map(r => r.date)
    );
    const failedTraining = new Set(
      db.prepare(`SELECT date FROM training_checkins WHERE user_id=? AND status='failed' AND date >= ?`)
        .all(userId, startDate).map(r => r.date)
    );
    const completedRuns = new Set(
      db.prepare(`SELECT date(completed_at) as d FROM running_progress WHERE user_id=? AND attempt_id=? AND completed_at IS NOT NULL`)
        .all(userId, attempt.id).map(r => r.d)
    );

    const days = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(startDate + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum  = i + 1;
      const weekPos = getWeekPos(dayNum);
      const dayType = getDayType(weekPos);
      const isPast  = dateStr < today;
      const isToday = dateStr === today;

      let status = 'upcoming';
      if (isToday) status = 'today';
      else if (isPast) {
        if (dayType === 'run' || dayType === 'recovery_run') {
          status = completedRuns.has(dateStr) ? 'completed' : 'missed';
        } else {
          status = completedTraining.has(dateStr) ? 'completed'
                 : failedTraining.has(dateStr)    ? 'missed'
                 : 'missed';
        }
      }

      days.push({ day: dayNum, date: dateStr, day_type: dayType, status, phase: getPhase(dayNum)?.phase });
    }

    res.json({ days, strikes: attempt.strikes || 0, try_number: attempt.try_number });
  } catch (e) { next(e); }
}

// ─── POST /program/reset ──────────────────────────────────────────────────────

function resetProgram(req, res, next) {
  try {
    const userId = req.user.id;
    db.prepare(`UPDATE program_attempts SET status='abandoned', ended_at=datetime('now') WHERE user_id=? AND status='active'`).run(userId);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

// ─── POST /program/strike ─────────────────────────────────────────────────────

function addStrike(req, res, next) {
  try {
    const result = recordStrike(req.user.id);
    res.json(result || { ok: true });
  } catch (e) { next(e); }
}

// ─── GET /program/today ───────────────────────────────────────────────────────

function getToday(req, res, next) {
  try {
    const userId  = req.user.id;
    const attempt = getActiveAttempt(userId);
    if (!attempt) return res.json({ plan: null });
    const plan = getTodayPlan(userId, attempt.id);
    res.json({ plan });
  } catch (e) { next(e); }
}

module.exports = { getStatus, generatePreview, setupProgram, getGrid, resetProgram, addStrike, getToday, calcSchedule, recordStrike };
