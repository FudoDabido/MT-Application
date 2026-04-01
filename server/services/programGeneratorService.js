'use strict';
const db = require('../db/database');

// ─── Constants ─────────────────────────────────────────────────────────────

const PHASES = [
  { phase: 1, name: 'Foundation', day_start: 1,  day_end: 20, target_reps: 100 },
  { phase: 2, name: 'Build',      day_start: 21, day_end: 40, target_reps: 200 },
  { phase: 3, name: 'Peak',       day_start: 41, day_end: 60, target_reps: 300 },
];

// weekPos 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat 7=Sun
// Odd weekPos (1,3,5) = strength. Even (2,4,6) = run. 7 = recovery run
const DAY_TYPE_MAP = {
  1: 'push',
  2: 'run',
  3: 'pull',
  4: 'run',
  5: 'legs',
  6: 'run',
  7: 'recovery_run',
};

const SLOT_MUSCLES = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'lats'],
  legs: ['quads', 'hamstrings', 'glutes'],
  core: ['abs', 'obliques', 'lower_back'],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWeekPos(currentDay) {
  return ((currentDay - 1) % 7) + 1;
}

function getDayType(weekPos) {
  return DAY_TYPE_MAP[weekPos];
}

function getRunDistance(runNumber) {
  return +(3.0 * Math.pow(1.055, runNumber - 1)).toFixed(2);
}

function getPhase(currentDay) {
  return PHASES.find(p => currentDay >= p.day_start && currentDay <= p.day_end) || null;
}

// ─── Phase generation ────────────────────────────────────────────────────────

function getExercisesForSlot(slot, equipmentNames, limit = 8) {
  const muscles = SLOT_MUSCLES[slot];
  if (!muscles) return [];

  // Build equipment filter
  let equipFilter = '';
  let equipParams = [];
  if (equipmentNames && equipmentNames.length > 0) {
    // Include bodyweight (required_equipment IS NULL or empty) + user equipment
    equipFilter = `AND (
      et.required_equipment IS NULL OR et.required_equipment = 'null' OR et.required_equipment = '[]' OR et.required_equipment = ''
      OR ${equipmentNames.map(() => `et.required_equipment LIKE ?`).join(' OR ')}
    )`;
    equipParams = equipmentNames.map(e => `%${e}%`);
  }

  const placeholders = muscles.map(() => '?').join(',');
  const query = `
    SELECT et.id, et.name, et.muscle_group, et.difficulty, et.is_compound, et.secondary_muscles
    FROM exercise_types et
    WHERE et.category = 'strength'
      AND et.is_system = 1
      AND et.muscle_group IN (${placeholders})
      ${equipFilter}
    ORDER BY et.is_compound DESC, et.difficulty ASC, RANDOM()
    LIMIT ?
  `;
  return db.prepare(query).all(...muscles, ...equipParams, limit);
}

function generatePhases(userId, equipmentNames = []) {
  return PHASES.map(phase => {
    const slot_pools = {};
    for (const slot of ['push', 'pull', 'legs', 'core']) {
      slot_pools[slot] = getExercisesForSlot(slot, equipmentNames, 8);
    }
    return { ...phase, slot_pools };
  });
}

// ─── Today's plan ─────────────────────────────────────────────────────────────

function getTodayPlan(userId, attemptId, targetDate = null) {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];

  // Get attempt start date
  const attempt = db.prepare(`SELECT started_at FROM program_attempts WHERE id=?`).get(attemptId);
  if (!attempt) return null;

  const startDate = attempt.started_at.split('T')[0];
  const start = new Date(startDate + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((target - start) / 86400000);
  const currentDay = diffDays + 1;

  if (currentDay < 1 || currentDay > 60) return null;

  const weekPos = getWeekPos(currentDay);
  const dayType = getDayType(weekPos);
  const phase   = getPhase(currentDay);

  // Get program setup for slot_pools
  const setup = db.prepare(`SELECT phases_json FROM program_setup WHERE attempt_id=?`).get(attemptId);
  if (!setup) return null;

  const phases = JSON.parse(setup.phases_json);
  const phaseData = phases.find(p => currentDay >= p.day_start && currentDay <= p.day_end);

  const base = {
    attempt_id:   attemptId,
    current_day:  currentDay,
    phase_number: phase?.phase,
    phase_name:   phase?.name,
    target_reps:  phase?.target_reps,
    day_type:     dayType,
  };

  // Running days
  if (dayType === 'run') {
    const runNumber = getRunNumber(userId, attemptId, dateStr);
    return {
      ...base,
      run_number:         runNumber,
      target_distance_km: getRunDistance(runNumber),
    };
  }

  if (dayType === 'recovery_run') {
    return {
      ...base,
      target_duration_min: 15,
    };
  }

  // Strength days (push/pull/legs)
  const slot = dayType; // 'push' | 'pull' | 'legs'
  const slotPool = phaseData?.slot_pools?.[slot] || [];
  const corePool = phaseData?.slot_pools?.core || [];

  // Check for overrides
  function getExerciseForSlot(s, pool) {
    const override = db.prepare(
      `SELECT exercise_type_id, exercise_name FROM day_workout_overrides WHERE user_id=? AND date=? AND slot=?`
    ).get(userId, dateStr, s);
    if (override) {
      return { id: override.exercise_type_id, name: override.exercise_name, slot: s, overridden: true };
    }
    // Get recently used exercise ids (last 3 days)
    const recentLogs = db.prepare(`
      SELECT DISTINCT tel.exercise_type_id
      FROM training_exercise_logs tel
      JOIN training_checkins tc ON tc.id = tel.checkin_id
      WHERE tel.user_id=? AND tc.date >= date(?, '-3 days') AND tc.date < ?
    `).all(userId, dateStr, dateStr).map(r => r.exercise_type_id);

    // Pick from pool — prefer not recently used, prefer compound
    const candidates = pool.filter(ex => !recentLogs.includes(ex.id));
    const pick = candidates.length > 0 ? candidates[0] : pool[0];
    if (!pick) return null;
    // Attach last session
    const last = db.prepare(`
      SELECT tel.reps_done, tel.weight_kg, tc.date
      FROM training_exercise_logs tel
      JOIN training_checkins tc ON tc.id = tel.checkin_id
      WHERE tel.user_id=? AND tel.exercise_type_id=? AND tc.status='completed' AND tc.date < ?
      ORDER BY tc.date DESC LIMIT 1
    `).get(userId, pick.id, dateStr);
    return { ...pick, slot: s, overridden: false, last_session: last || null };
  }

  // 3 exercises from main slot + 1 core
  const mainExercises = [];
  // Pick 3 unique from main slot pool
  const usedIds = new Set();
  for (const ex of slotPool) {
    if (mainExercises.length >= 3) break;
    if (!usedIds.has(ex.id)) {
      usedIds.add(ex.id);
      const last = db.prepare(`
        SELECT tel.reps_done, tel.weight_kg, tc.date
        FROM training_exercise_logs tel
        JOIN training_checkins tc ON tc.id = tel.checkin_id
        WHERE tel.user_id=? AND tel.exercise_type_id=? AND tc.status='completed' AND tc.date < ?
        ORDER BY tc.date DESC LIMIT 1
      `).get(userId, ex.id, dateStr);
      mainExercises.push({ ...ex, slot, overridden: false, last_session: last || null });
    }
  }
  const coreEx = getExerciseForSlot('core', corePool);
  const rawExercises = [...mainExercises, ...(coreEx ? [coreEx] : [])].filter(Boolean);

  // Attach sets/reps based on phase target_reps (total / 4 exercises)
  const targetReps = phase?.target_reps || 100;
  const repsPerEx  = Math.round(targetReps / 4);
  // sets × reps_per_set combos: phase1→3×8, phase2→4×12, phase3→5×15
  const setsRepsMap = { 100: { sets: 3, reps: 8 }, 200: { sets: 4, reps: 12 }, 300: { sets: 5, reps: 15 } };
  const { sets, reps } = setsRepsMap[targetReps] || { sets: 3, reps: Math.ceil(repsPerEx / 3) };
  const exercises = rawExercises.map(ex => ({ ...ex, sets, reps }));

  return { ...base, exercises };
}

function getRunNumber(userId, attemptId, upToDate = null) {
  const dateStr = upToDate || new Date().toISOString().split('T')[0];
  // Count completed runs for this attempt (from workout_logs with session_type='running' or from run_number in running_progress)
  const count = db.prepare(`
    SELECT COUNT(*) as cnt FROM running_progress
    WHERE user_id=? AND attempt_id=? AND completed_at IS NOT NULL AND completed_at < ?
  `).get(userId, attemptId, dateStr + 'T23:59:59')?.cnt || 0;
  return count + 1;
}

module.exports = { generatePhases, getTodayPlan, getRunDistance, getRunNumber, getWeekPos, getDayType, getPhase, PHASES };
