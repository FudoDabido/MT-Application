'use strict';
const db = require('../db/database');

// ── Muscle metadata: recovery hours, daily load threshold, antagonist ─────────
const MUSCLE_META = {
  chest:       { recovery: 60, threshold: 100, antagonist: 'back'       },
  back:        { recovery: 60, threshold: 100, antagonist: 'chest'      },
  lats:        { recovery: 60, threshold:  90, antagonist: 'chest'      },
  shoulders:   { recovery: 48, threshold: 100, antagonist: null         },
  biceps:      { recovery: 48, threshold:  80, antagonist: 'triceps'    },
  triceps:     { recovery: 48, threshold:  80, antagonist: 'biceps'     },
  traps:       { recovery: 48, threshold:  80, antagonist: null         },
  forearms:    { recovery: 48, threshold:  60, antagonist: null         },
  quads:       { recovery: 60, threshold: 120, antagonist: 'hamstrings' },
  hamstrings:  { recovery: 60, threshold: 120, antagonist: 'quads'      },
  glutes:      { recovery: 60, threshold: 130, antagonist: 'hip_flexors'},
  hip_flexors: { recovery: 48, threshold:  70, antagonist: 'glutes'     },
  adductors:   { recovery: 48, threshold:  70, antagonist: 'abductors'  },
  abductors:   { recovery: 48, threshold:  70, antagonist: 'adductors'  },
  calves:      { recovery: 48, threshold:  60, antagonist: null         },
  abs:         { recovery: 36, threshold: 100, antagonist: 'lower_back' },
  obliques:    { recovery: 36, threshold:  80, antagonist: null         },
  lower_back:  { recovery: 60, threshold:  80, antagonist: 'abs'        },
  core:        { recovery: 36, threshold: 100, antagonist: 'lower_back' },
  neck:        { recovery: 36, threshold:  40, antagonist: null         },
  full_body:   { recovery: 72, threshold: 200, antagonist: null         },
  cardio:      { recovery: 36, threshold: 150, antagonist: null         },
};

// Secondary muscles receive 40% of the rep load
const SECONDARY_LOAD_PCT = 0.40;

// Difficulty multipliers
const DIFFICULTY_FACTOR = { beginner: 1.0, intermediate: 1.3, advanced: 1.7 };

/**
 * Record muscle load when exercise reps are logged.
 * Called from trainingCheckinController.logExercise after DB insert.
 */
function trackLoad(userId, exerciseTypeId, repsDone, weightKg, date) {
  if (!repsDone || repsDone <= 0) return;

  const exercise = db.prepare(
    'SELECT muscle_group, secondary_muscles, difficulty FROM exercise_types WHERE id=?'
  ).get(exerciseTypeId);
  if (!exercise) return;

  const difficulty  = exercise.difficulty || 'intermediate';
  const factor      = DIFFICULTY_FACTOR[difficulty] || 1.3;
  const weightBonus = weightKg ? 1 + (weightKg / 100) : 1.0; // slight boost for weighted work
  const baseLoad    = repsDone * factor * weightBonus;

  const upsertLoad = db.prepare(`
    INSERT INTO muscle_load_history (user_id, date, muscle_group, load_units)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date, muscle_group) DO UPDATE SET
      load_units = load_units + excluded.load_units
  `);

  db.exec('BEGIN');
  try {
    // Primary muscle — 100% load
    if (exercise.muscle_group && exercise.muscle_group !== 'cardio') {
      upsertLoad.run(userId, date, exercise.muscle_group, baseLoad);
    }

    // Secondary muscles — 40% load each
    if (exercise.secondary_muscles) {
      const secondaries = exercise.secondary_muscles.split(',').map(s => s.trim()).filter(Boolean);
      for (const muscle of secondaries) {
        const cleanMuscle = muscle.toLowerCase().replace(/\s+/g, '_');
        if (MUSCLE_META[cleanMuscle]) {
          upsertLoad.run(userId, date, cleanMuscle, baseLoad * SECONDARY_LOAD_PCT);
        }
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('[muscleLoadService] trackLoad error:', e.message);
  }
}

/**
 * Get recovery status for all muscle groups for a user.
 * Returns map: { muscle_group: { load_today, load_yesterday, hours_since_load, recovery_pct, is_ready } }
 */
function getRecoveryStatus(userId, forDate) {
  const today = forDate || new Date().toISOString().split('T')[0];

  // Load for the last 7 days
  const rows = db.prepare(`
    SELECT date, muscle_group, load_units
    FROM muscle_load_history
    WHERE user_id=? AND date >= date(?, '-7 days') AND date <= ?
    ORDER BY date DESC
  `).all(userId, today, today);

  const status = {};

  for (const [muscle, meta] of Object.entries(MUSCLE_META)) {
    const muscleRows = rows.filter(r => r.muscle_group === muscle);
    const todayRow   = muscleRows.find(r => r.date === today);
    // Most recent load — include today (today counts as just loaded = low recovery)
    const lastLoaded = [...muscleRows].sort((a, b) => b.date.localeCompare(a.date))[0];

    let hoursSince = Infinity;
    if (lastLoaded) {
      if (lastLoaded.date === today) {
        // Loaded today: hours since midnight (conservative — muscle was just worked)
        const now = new Date();
        const midnight = new Date(today + 'T00:00:00');
        hoursSince = Math.floor((now - midnight) / 3600000);
      } else {
        const lastDate = new Date(lastLoaded.date + 'T12:00:00');
        const nowDate  = new Date(today + 'T12:00:00');
        hoursSince = Math.floor((nowDate - lastDate) / 3600000);
      }
    }

    const recoveryPct   = Math.min(hoursSince / meta.recovery, 1.0);
    const todayLoad     = todayRow ? todayRow.load_units : 0;
    const thresholdLeft = Math.max(0, meta.threshold - todayLoad);

    status[muscle] = {
      load_today:        Math.round(todayLoad),
      load_last_session: lastLoaded ? Math.round(lastLoaded.load_units) : 0,
      hours_since_load:  hoursSince === Infinity ? null : hoursSince,
      recovery_pct:      Math.round(recoveryPct * 100),
      is_ready:          recoveryPct >= 0.80 && thresholdLeft > 0,
      threshold_left:    Math.round(thresholdLeft),
      daily_threshold:   meta.threshold,
    };
  }

  return status;
}

/**
 * Get stretch/yoga recommendations for muscles loaded on a given date.
 * Returns exercises where is_stretching=1 that target the loaded muscles.
 */
function getStretchRecommendations(userId, date) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Get muscles loaded today, sorted by load (most loaded first)
  const loaded = db.prepare(`
    SELECT muscle_group, load_units
    FROM muscle_load_history
    WHERE user_id=? AND date=?
    ORDER BY load_units DESC
    LIMIT 6
  `).all(userId, targetDate);

  if (!loaded.length) return [];

  const muscles = loaded.map(r => r.muscle_group);

  // Find stretches that target these muscles (primary or secondary)
  const placeholders = muscles.map(() => '?').join(',');
  const stretches = db.prepare(`
    SELECT DISTINCT et.id, et.name, et.muscle_group, et.secondary_muscles,
           et.difficulty, et.description, et.movement_type
    FROM exercise_types et
    WHERE et.is_stretching = 1
      AND (
        et.muscle_group IN (${placeholders})
        OR (et.secondary_muscles IS NOT NULL AND (
          ${muscles.map(() => "et.secondary_muscles LIKE ?").join(' OR ')}
        ))
      )
    ORDER BY
      CASE WHEN et.muscle_group = ? THEN 0 ELSE 1 END,
      et.difficulty ASC
    LIMIT 12
  `).all(
    ...muscles,                           // for muscle_group IN
    ...muscles.map(m => `%${m}%`),        // for LIKE clauses
    muscles[0]                            // ORDER BY most-loaded first
  );

  return stretches.map(s => ({
    id:                s.id,
    name:              s.name,
    muscle_group:      s.muscle_group,
    secondary_muscles: s.secondary_muscles,
    difficulty:        s.difficulty,
    description:       s.description,
    targets_loaded:    muscles.includes(s.muscle_group),
  }));
}

module.exports = { trackLoad, getRecoveryStatus, getStretchRecommendations, MUSCLE_META };
