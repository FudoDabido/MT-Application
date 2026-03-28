'use strict';
const db = require('../db/database');
const { getRecoveryStatus, MUSCLE_META } = require('./muscleLoadService');
const { getRunPlan, isSundayRun } = require('./runningProgressService');


// ── Cardio day config ─────────────────────────────────────────────────────────
// Three cardio slots per cardio day
const CARDIO_SLOTS = [
  { slot: 'steady',   label: 'Steady Cardio', preferred: ['full_body', 'legs'],     type: 'duration' },
  { slot: 'hiit',     label: 'HIIT Burst',    preferred: ['full_body', 'core'],     type: 'reps'     },
  { slot: 'moderate', label: 'Active Cardio', preferred: ['core', 'full_body'],     type: 'reps'     },
];

// Cardio targets per phase
const CARDIO_TARGETS = {
  1: { duration_mins: 20, hiit_reps: 100, moderate_reps: 100 },
  2: { duration_mins: 25, hiit_reps: 150, moderate_reps: 150 },
  3: { duration_mins: 30, hiit_reps: 150, moderate_reps: 200 },
  4: { duration_mins: 30, hiit_reps: 200, moderate_reps: 200 },
};

// Steady-state exercise IDs (machine/sustained cardio preferred)
const STEADY_PREFERRED_IDS = new Set([4, 90, 91, 92, 93, 94, 95]); // Run, Treadmill, Bike, Row, Elliptical, JumpRope

function pickCardioExercises(phaseNum, equipKeywords, allExercises) {
  const targets = CARDIO_TARGETS[phaseNum] || CARDIO_TARGETS[1];
  const cardioPool = allExercises.filter(ex =>
    ex.category === 'cardio' &&
    (!ex.is_stretching || ex.is_stretching === 0) &&
    hasEquipment(ex.required_equipment, equipKeywords)
  );

  const usedIds = new Set();

  // Slot 1: Steady — prefer machines/running
  const steadyCandidates = cardioPool.filter(ex => STEADY_PREFERRED_IDS.has(ex.id) && !usedIds.has(ex.id));
  const steady = steadyCandidates[0] || cardioPool.find(ex => !usedIds.has(ex.id));
  if (steady) usedIds.add(steady.id);

  // Slot 2: HIIT — high MET, not already used
  const hiitCandidates = cardioPool.filter(ex => !usedIds.has(ex.id) && (ex.met_value || 0) >= 9);
  const hiit = hiitCandidates[0] || cardioPool.find(ex => !usedIds.has(ex.id));
  if (hiit) usedIds.add(hiit.id);

  // Slot 3: Moderate — anything remaining
  const modCandidates = cardioPool.filter(ex => !usedIds.has(ex.id));
  const moderate = modCandidates[0] || null;

  return [
    steady   ? { ...CARDIO_SLOTS[0], id: steady.id,   name: steady.name,   muscle_group: steady.muscle_group,   target_duration_mins: targets.duration_mins, target_reps: null } : null,
    hiit     ? { ...CARDIO_SLOTS[1], id: hiit.id,     name: hiit.name,     muscle_group: hiit.muscle_group,     target_duration_mins: null, target_reps: targets.hiit_reps } : null,
    moderate ? { ...CARDIO_SLOTS[2], id: moderate.id, name: moderate.name, muscle_group: moderate.muscle_group, target_duration_mins: null, target_reps: targets.moderate_reps } : null,
  ].filter(Boolean);
}

// ── Slot definitions: muscle rotation per slot ──────────────────────────────
// Each slot has a list of muscles it can target, in priority order per phase
const SLOT_MUSCLES = {
  push: {
    1: ['chest',     'shoulders', 'triceps'],
    2: ['shoulders', 'triceps',   'chest'  ],
    3: ['triceps',   'chest',     'shoulders'],
    4: ['chest',     'shoulders', 'triceps'],
  },
  pull: {
    1: ['back',      'biceps',    'lats'   ],
    2: ['biceps',    'lats',      'back'   ],
    3: ['lats',      'back',      'biceps' ],
    4: ['back',      'lats',      'biceps' ],
  },
  legs: {
    1: ['quads',     'hamstrings','glutes' ],
    2: ['glutes',    'quads',     'hamstrings'],
    3: ['hamstrings','glutes',    'quads'  ],
    4: ['quads',     'glutes',    'hamstrings'],
  },
  core: {
    1: ['abs',       'obliques',  'lower_back'],
    2: ['obliques',  'lower_back','abs'     ],
    3: ['lower_back','abs',       'obliques'],
    4: ['abs',       'obliques',  'lower_back'],
  },
};

// Fallback muscles if primary not found
const FALLBACKS = {
  chest:       ['upper_chest', 'shoulders', 'full_body'],
  back:        ['lats', 'upper_back', 'full_body'],
  lats:        ['back', 'full_body'],
  quads:       ['full_body', 'glutes'],
  abs:         ['core', 'obliques'],
  shoulders:   ['chest', 'triceps'],
  biceps:      ['back', 'lats'],
  glutes:      ['hamstrings', 'quads'],
  obliques:    ['abs', 'core'],
  triceps:     ['shoulders', 'chest'],
  hamstrings:  ['glutes', 'quads'],
  lower_back:  ['core', 'abs'],
};

function buildEquipmentKeywords(userEquipItems) {
  const keywords = new Set(['null', 'bodyweight']);
  userEquipItems.forEach(item => {
    const n = (item.name || '').toLowerCase();
    keywords.add(item.category);
    if (n.includes('pull-up') || n.includes('pullup'))  keywords.add('pull_up_bar');
    if (n.includes('dip'))                              keywords.add('dip_bars');
    if (n.includes('dumbbell'))                         { keywords.add('dumbbell'); keywords.add('dumbbells'); }
    if (n.includes('barbell'))                          keywords.add('barbell');
    if (n.includes('ez bar') || n.includes('ez-bar'))   keywords.add('ez_bar');
    if (n.includes('kettlebell'))                       { keywords.add('kettlebell'); keywords.add('kettlebells'); }
    if (n.includes('bench'))                            { keywords.add('bench'); keywords.add('flat_bench'); keywords.add('adjustable_bench'); }
    if (n.includes('resistance band') || n.includes('tube band')) { keywords.add('resistance_band'); keywords.add('resistance_bands'); keywords.add('bands'); }
    if (n.includes('loop band'))                        keywords.add('loop_bands');
    if (n.includes('cable'))                            keywords.add('cable_machine');
    if (n.includes('smith'))                            keywords.add('smith_machine');
    if (n.includes('leg press'))                        keywords.add('leg_press_machine');
    if (n.includes('lat pulldown'))                     keywords.add('lat_pulldown_machine');
    if (n.includes('chest press'))                      keywords.add('chest_press_machine');
    if (n.includes('shoulder press machine'))           keywords.add('shoulder_press_machine');
    if (n.includes('pec deck'))                         keywords.add('pec_deck_machine');
    if (n.includes('leg curl'))                         keywords.add('leg_curl_machine');
    if (n.includes('leg extension'))                    keywords.add('leg_extension_machine');
    if (n.includes('hip thrust machine'))               keywords.add('hip_thrust_machine');
    if (n.includes('hack squat'))                       keywords.add('hack_squat_machine');
    if (n.includes('calf raise'))                       keywords.add('calf_raise_machine');
    if (n.includes('ab crunch'))                        keywords.add('ab_crunch_machine');
    if (n.includes('back extension'))                   keywords.add('back_extension_machine');
    if (n.includes('assisted pull'))                    keywords.add('assisted_pullup_machine');
    if (n.includes('treadmill'))                        keywords.add('treadmill');
    if (n.includes('stationary bike'))                  keywords.add('stationary_bike');
    if (n.includes('rowing machine'))                   keywords.add('rowing_machine');
    if (n.includes('elliptical'))                       keywords.add('elliptical');
    if (n.includes('jump rope'))                        keywords.add('jump_rope');
    if (n.includes('trx') || n.includes('suspension'))  keywords.add('trx');
    if (n.includes('medicine ball'))                    keywords.add('medicine_ball');
    if (n.includes('battle rope'))                      keywords.add('battle_ropes');
    if (n.includes('kettlebell'))                       keywords.add('kettlebell');
  });
  return keywords;
}

function hasEquipment(requiredEquipment, keywords) {
  if (!requiredEquipment || requiredEquipment === 'null') return true;
  try {
    const arr = JSON.parse(requiredEquipment);
    if (!arr || arr.length === 0) return true;
    return arr.every(req => keywords.has(req));
  } catch { return true; }
}

/**
 * Pick best exercise for a slot on a given day using recovery data.
 * Priority: most-recovered muscle in the slot rotation → compound preferred → not recently used
 */
function pickExerciseForSlot(slot, phaseNum, equipKeywords, recoveryStatus, recentUsedIds, allExercises) {
  const muscleOptions = SLOT_MUSCLES[slot][phaseNum] || SLOT_MUSCLES[slot][1];

  // Sort muscle options by recovery % (most recovered first)
  const sortedMuscles = [...muscleOptions].sort((a, b) => {
    const rA = recoveryStatus[a]?.recovery_pct ?? 100;
    const rB = recoveryStatus[b]?.recovery_pct ?? 100;
    return rB - rA;
  });

  for (const muscle of sortedMuscles) {
    const musclesToTry = [muscle, ...(FALLBACKS[muscle] || [])];
    for (const m of musclesToTry) {
      const candidates = allExercises.filter(ex =>
        ex.muscle_group === m &&
        hasEquipment(ex.required_equipment, equipKeywords) &&
        !recentUsedIds.has(ex.id) &&
        ex.category === 'strength' &&
        (!ex.is_stretching || ex.is_stretching === 0)
      );
      // Prefer compound, then any
      const pick = candidates.find(c => c.is_compound === 1) || candidates[0];
      if (pick) return { exercise: pick, targetMuscle: muscle };
    }
  }

  // Last resort: any bodyweight non-stretching strength exercise
  const fallback = allExercises.find(ex =>
    (!ex.required_equipment || ex.required_equipment === 'null') &&
    !recentUsedIds.has(ex.id) &&
    ex.category === 'strength' &&
    (!ex.is_stretching || ex.is_stretching === 0)
  );
  return fallback ? { exercise: fallback, targetMuscle: slot } : null;
}

/**
 * Build an exercise pool per slot (8 exercises covering all muscle options).
 * Used at program generation time to store options in phases_json.
 */
function buildSlotPool(slot, phaseNum, equipKeywords, allExercises) {
  const muscleOptions = SLOT_MUSCLES[slot][phaseNum] || SLOT_MUSCLES[slot][1];
  const pool = [];
  const usedIds = new Set();

  // Get 2-3 exercises per muscle option
  for (const muscle of muscleOptions) {
    const musclesToTry = [muscle, ...(FALLBACKS[muscle] || [])];
    let found = 0;
    for (const m of musclesToTry) {
      if (found >= 3) break;
      const candidates = allExercises.filter(ex =>
        ex.muscle_group === m &&
        hasEquipment(ex.required_equipment, equipKeywords) &&
        !usedIds.has(ex.id) &&
        ex.category === 'strength' &&
        (!ex.is_stretching || ex.is_stretching === 0)
      );
      const compounds = candidates.filter(c => c.is_compound === 1).slice(0, 2);
      const others    = candidates.filter(c => c.is_compound !== 1).slice(0, 1);
      for (const ex of [...compounds, ...others]) {
        if (found >= 3) break;
        pool.push({
          id: ex.id,
          name: ex.name,
          muscle_group: ex.muscle_group,
          difficulty: ex.difficulty,
          is_compound: ex.is_compound,
          required_equipment: ex.required_equipment,
        });
        usedIds.add(ex.id);
        found++;
      }
    }
  }

  return pool;
}

/**
 * Generate 4 phases × 14 days = 60-day program.
 * Each phase stores an exercise pool per slot, not a single fixed exercise.
 */
function generatePhases(userId) {
  const allExercises = db.prepare(
    'SELECT * FROM exercise_types WHERE is_system=1 OR created_by=?'
  ).all(userId);

  const userEquip = db.prepare(`
    SELECT ei.* FROM user_equipment ue
    JOIN equipment_items ei ON ei.id = ue.equipment_item_id
    WHERE ue.user_id = ?
  `).all(userId);

  const equipKeywords = buildEquipmentKeywords(userEquip);
  const phases = [];

  for (let p = 0; p < 4; p++) {
    const phaseNum = p + 1;
    const slots = ['push', 'pull', 'legs', 'core'];
    const slotPools = {};

    for (const slot of slots) {
      slotPools[slot] = buildSlotPool(slot, phaseNum, equipKeywords, allExercises);
    }

    // For backward compatibility: default exercise per slot = first compound in pool
    const exercises = slots.map(slot => {
      const pool = slotPools[slot];
      const ex = pool.find(e => e.is_compound === 1) || pool[0];
      return ex ? { ...ex, slot } : null;
    }).filter(Boolean);

    phases.push({
      phase:       phaseNum,
      day_start:   p * 14 + 1,
      day_end:     p === 3 ? 60 : (p + 1) * 14,
      week1_reps:  100,
      week2_reps:  150,
      exercises,    // default (backward compat)
      slot_pools:  slotPools, // NEW: recovery-aware selection uses this
    });
  }

  return phases;
}

/**
 * Get today's plan — uses muscle recovery data to pick the best exercise
 * from each slot's pool.
 */
function getTodayPlan(userId, attemptId, targetDate) {
  const setup = db.prepare(
    'SELECT * FROM program_setup WHERE attempt_id=? AND user_id=?'
  ).get(attemptId, userId);
  if (!setup) return null;

  const attempt = db.prepare('SELECT * FROM program_attempts WHERE id=?').get(attemptId);
  if (!attempt) return null;

  const startDate = attempt.started_at.split(' ')[0];
  const dateStr   = targetDate || new Date().toISOString().split('T')[0];
  const currentDay = Math.floor((new Date(dateStr) - new Date(startDate)) / 86400000) + 1;

  if (currentDay < 1 || currentDay > 60) return null;

  const phases = JSON.parse(setup.phases_json);
  const phase  = phases.find(p => currentDay >= p.day_start && currentDay <= p.day_end);
  if (!phase) return null;

  // ── Weekly pattern: S/R/S/R/S/R/RR (Mon-Sun) ──────────────────────────────
  // weekPos 1=Mon,2=Tue,...,7=Sun — repeats every 7 days
  const weekPos = ((currentDay - 1) % 7) + 1;
  const dayType = weekPos === 7 ? 'recovery_run' : (weekPos % 2 === 0 ? 'running' : 'strength');

  if (dayType === 'running' || dayType === 'recovery_run') {
    // Running day — progressive distance or Sunday recovery run
    const isRecovery   = dayType === 'recovery_run';
    const runPlan      = getRunPlan(userId, attemptId, currentDay, dateStr);
    const todayDoneRun = db.prepare('SELECT 1 FROM running_progress WHERE user_id=? AND attempt_id=? AND date(completed_at)=? LIMIT 1')
                           .get(userId, attemptId, dateStr);
    return {
      current_day:          currentDay,
      day_type:             isRecovery ? 'recovery_run' : 'running',
      phase_number:         phase.phase,
      day_in_phase:         currentDay - phase.day_start + 1,
      week_in_phase:        currentDay - phase.day_start + 1 <= 7 ? 1 : 2,
      target_reps:          null,
      target_distance_km:   runPlan.target_distance_km,
      target_duration_min:  runPlan.target_duration_min,
      run_number:           runPlan.run_number,
      is_recovery_run:      runPlan.is_recovery_run,
      actual_distance_km:   runPlan.actual_distance_km,
      attempt_id:           attemptId,
      exercises:            [],
      today_done:           !!todayDoneRun || runPlan.completed_today,
      today:                dateStr,
      rep_totals:           {},
      muscle_recovery:      {},
    };
  }

  const dayInPhase   = currentDay - phase.day_start + 1;
  const weekInPhase  = dayInPhase <= 7 ? 1 : 2;
  const targetReps   = weekInPhase === 1 ? phase.week1_reps : phase.week2_reps;

  // ── Smart exercise selection using recovery status ──────────────────────────
  let exercises;
  const slotPools = phase.slot_pools;

  if (slotPools) {
    // Get recovery status for this user as of yesterday
    // (we want to pick based on what was loaded before today's session)
    const yesterday = new Date(new Date(dateStr).getTime() - 86400000).toISOString().split('T')[0];
    const recoveryStatus = getRecoveryStatus(userId, dateStr);

    // Get recently used exercise IDs (last 3 days) to avoid repetition
    const recentLogs = db.prepare(`
      SELECT DISTINCT tel.exercise_type_id
      FROM training_exercise_logs tel
      JOIN training_checkins tc ON tc.id = tel.checkin_id
      WHERE tel.user_id=? AND tc.date >= date(?, '-3 days') AND tc.date < ?
    `).all(userId, dateStr, dateStr);
    const recentUsedIds = new Set(recentLogs.map(r => r.exercise_type_id));

    const userEquip = db.prepare(`
      SELECT ei.* FROM user_equipment ue
      JOIN equipment_items ei ON ei.id = ue.equipment_item_id
      WHERE ue.user_id = ?
    `).all(userId);
    const equipKeywords = buildEquipmentKeywords(userEquip);
    const allExercises  = db.prepare(
      'SELECT * FROM exercise_types WHERE is_system=1 OR created_by=?'
    ).all(userId);

    exercises = ['push', 'pull', 'legs', 'core'].map(slot => {
      // Check for day-specific override first
      const override = db.prepare(
        'SELECT * FROM day_workout_overrides WHERE user_id=? AND date=? AND slot=?'
      ).get(userId, dateStr, slot);
      if (override) {
        return {
          id:           override.exercise_type_id,
          name:         override.exercise_name,
          slot,
          overridden:   true,
          muscle_group: null,
        };
      }

      // Recovery-based pick from pool
      const pool = slotPools[slot] || [];
      if (pool.length === 0) return null;

      // Find best exercise in pool: most-recovered muscle, not recently used
      const poolWithRecovery = pool.map(ex => {
        const muscle  = ex.muscle_group;
        const rec     = recoveryStatus[muscle];
        const recPct  = rec?.recovery_pct ?? 100;
        const isRecent = recentUsedIds.has(ex.id) ? -50 : 0; // penalize recent use
        return { ...ex, slot, score: recPct + isRecent };
      });

      const best = poolWithRecovery.sort((a, b) => b.score - a.score)[0];
      return best || null;
    }).filter(Boolean);
  } else {
    // Fallback for old phases_json without slot_pools
    const overrides = db.prepare(
      'SELECT * FROM day_workout_overrides WHERE user_id=? AND date=?'
    ).all(userId, dateStr);
    exercises = phase.exercises.map(ex => {
      const ov = overrides.find(o => o.slot === ex.slot);
      if (ov) return { ...ex, id: ov.exercise_type_id, name: ov.exercise_name, overridden: true };
      return ex;
    });
  }

  // Attach last session data
  if (exercises.length) {
    exercises = exercises.map(ex => {
      const last = db.prepare(`
        SELECT tel.reps_done, tel.weight_kg, tc.date
        FROM training_exercise_logs tel
        JOIN training_checkins tc ON tc.id = tel.checkin_id
        WHERE tel.user_id=? AND tel.exercise_type_id=? AND tc.status='completed' AND tc.date < ?
        ORDER BY tc.date DESC, tel.logged_at DESC LIMIT 1
      `).get(userId, ex.id, dateStr);
      return { ...ex, last_session: last || null };
    });
  }

  // Check both tables: free workout_logs AND program training_checkins
  const todayCheckin = db.prepare(
    "SELECT id FROM training_checkins WHERE user_id=? AND date=? AND status='completed' LIMIT 1"
  ).get(userId, dateStr);
  const todayDone = !!todayCheckin || !!db.prepare(
    "SELECT 1 FROM workout_logs WHERE user_id=? AND date(logged_at)=? LIMIT 1"
  ).get(userId, dateStr);

  // If training already completed today, show the ACTUAL logged exercises
  // instead of re-running the recovery-based algorithm (which may pick different ones)
  if (todayCheckin) {
    const loggedExs = db.prepare(`
      SELECT DISTINCT exercise_type_id as id, exercise_name as name
      FROM training_exercise_logs WHERE user_id=? AND checkin_id=?
      ORDER BY id ASC
    `).all(userId, todayCheckin.id);
    if (loggedExs.length > 0) {
      exercises = loggedExs.map(e => ({ ...e, slot: null, last_session: null }));
    }
  }

  const repRows = db.prepare(`
    SELECT exercise_type_id, SUM(reps_done) as total_reps
    FROM training_exercise_logs
    WHERE user_id=? AND date(logged_at)=?
    GROUP BY exercise_type_id
  `).all(userId, dateStr);
  const repTotals = {};
  repRows.forEach(r => { repTotals[r.exercise_type_id] = r.total_reps || 0; });

  // Attach recovery status so the client can show "chest 85% recovered" etc.
  const recoveryStatus = getRecoveryStatus(userId, dateStr);
  const muscleRecovery = {};
  for (const ex of exercises) {
    if (ex.muscle_group && recoveryStatus[ex.muscle_group]) {
      muscleRecovery[ex.muscle_group] = recoveryStatus[ex.muscle_group];
    }
  }

  return {
    attempt_id:     attemptId,
    current_day:    currentDay,
    day_type:       'strength',
    phase_number:   phase.phase,
    day_in_phase:   dayInPhase,
    week_in_phase:  weekInPhase,
    target_reps:    targetReps,
    exercises,
    today_done:     !!todayDone,
    today:          dateStr,
    rep_totals:     repTotals,
    muscle_recovery: muscleRecovery,
  };
}

module.exports = {
  generatePhases,
  getTodayPlan,
  buildEquipmentKeywords,
  hasEquipment,
  PHASE_ROTATION_EXPORT: SLOT_MUSCLES,
};
