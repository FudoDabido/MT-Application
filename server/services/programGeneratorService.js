const db = require('../db/database');

// Which muscle to target per slot per phase
// Slots: push, pull, legs, core
const PHASE_ROTATION = [
  { push: 'chest',       pull: 'back',       legs: 'quads',      core: 'abs'        },
  { push: 'shoulders',   pull: 'biceps',     legs: 'glutes',     core: 'obliques'   },
  { push: 'triceps',     pull: 'upper_back', legs: 'hamstrings', core: 'lower_back' },
  { push: 'chest',       pull: 'back',       legs: 'quads',      core: 'core'       },
];

// Fallback muscle groups if primary not found
const FALLBACKS = {
  chest:       ['upper_chest', 'full_body'],
  back:        ['upper_back', 'full_body'],
  quads:       ['full_body', 'glutes'],
  abs:         ['core', 'obliques'],
  shoulders:   ['chest', 'triceps'],
  biceps:      ['back', 'upper_back'],
  glutes:      ['hamstrings', 'quads'],
  obliques:    ['abs', 'core'],
  triceps:     ['shoulders', 'chest'],
  upper_back:  ['back', 'rear_delts'],
  hamstrings:  ['glutes', 'quads'],
  lower_back:  ['core', 'abs'],
};

function buildEquipmentKeywords(userEquipItems) {
  const keywords = new Set(['null', 'bodyweight']);
  userEquipItems.forEach(item => {
    const n = (item.name || '').toLowerCase();
    keywords.add(item.category);
    if (n.includes('pull-up') || n.includes('pullup')) { keywords.add('pull_up_bar'); }
    if (n.includes('dip')) keywords.add('dip_bars');
    if (n.includes('dumbbell')) keywords.add('dumbbells');
    if (n.includes('barbell')) keywords.add('barbell');
    if (n.includes('ez bar') || n.includes('ez-bar')) keywords.add('ez_bar');
    if (n.includes('kettlebell')) keywords.add('kettlebells');
    if (n.includes('bench')) { keywords.add('bench'); keywords.add('flat_bench'); keywords.add('adjustable_bench'); }
    if (n.includes('resistance band') || n.includes('tube band')) { keywords.add('resistance_bands'); keywords.add('bands'); }
    if (n.includes('loop band')) keywords.add('loop_bands');
    if (n.includes('cable')) keywords.add('cable_machine');
    if (n.includes('smith')) keywords.add('smith_machine');
    if (n.includes('leg press')) keywords.add('leg_press_machine');
    if (n.includes('lat pulldown')) keywords.add('lat_pulldown_machine');
    if (n.includes('chest press')) keywords.add('chest_press_machine');
    if (n.includes('shoulder press machine')) keywords.add('shoulder_press_machine');
    if (n.includes('pec deck')) keywords.add('pec_deck_machine');
    if (n.includes('leg curl')) keywords.add('leg_curl_machine');
    if (n.includes('leg extension')) keywords.add('leg_extension_machine');
    if (n.includes('hip thrust machine')) keywords.add('hip_thrust_machine');
    if (n.includes('hack squat')) keywords.add('hack_squat_machine');
    if (n.includes('calf raise machine')) keywords.add('calf_raise_machine');
    if (n.includes('ab crunch machine')) keywords.add('ab_crunch_machine');
    if (n.includes('back extension')) keywords.add('back_extension_machine');
    if (n.includes('assisted pull')) keywords.add('assisted_pullup_machine');
    if (n.includes('treadmill')) keywords.add('treadmill');
    if (n.includes('stationary bike')) keywords.add('stationary_bike');
    if (n.includes('rowing machine')) keywords.add('rowing_machine');
    if (n.includes('elliptical')) keywords.add('elliptical');
    if (n.includes('jump rope')) keywords.add('jump_rope');
    if (n.includes('trx') || n.includes('suspension')) keywords.add('trx');
    if (n.includes('medicine ball')) keywords.add('medicine_ball');
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

function pickExercise(targetMuscle, equipKeywords, usedIds, allExercises) {
  const muscles = [targetMuscle, ...(FALLBACKS[targetMuscle] || [])];
  for (const muscle of muscles) {
    // Prefer compound exercises, then any
    const candidates = allExercises.filter(ex =>
      ex.muscle_group === muscle &&
      hasEquipment(ex.required_equipment, equipKeywords) &&
      !usedIds.has(ex.id) &&
      ex.category === 'strength' // skip pure cardio for structured reps
    );
    const compound = candidates.find(c => c.is_compound === 1);
    const chosen = compound || candidates[0];
    if (chosen) return chosen;
  }
  // Last resort: any bodyweight exercise not used
  const fallback = allExercises.find(ex =>
    (!ex.required_equipment || ex.required_equipment === 'null') &&
    !usedIds.has(ex.id) &&
    ex.category === 'strength'
  );
  return fallback || null;
}

function generatePhases(userId) {
  const allExercises = db.prepare('SELECT * FROM exercise_types WHERE is_system=1 OR created_by=?').all(userId);
  const userEquip = db.prepare(`
    SELECT ei.* FROM user_equipment ue
    JOIN equipment_items ei ON ei.id = ue.equipment_item_id
    WHERE ue.user_id = ?
  `).all(userId);

  const equipKeywords = buildEquipmentKeywords(userEquip);
  const usedIds = new Set();
  const phases = [];

  for (let p = 0; p < 4; p++) {
    const rotation = PHASE_ROTATION[p];
    const slots = ['push', 'pull', 'legs', 'core'];
    const exercises = [];

    for (const slot of slots) {
      const muscle = rotation[slot];
      const ex = pickExercise(muscle, equipKeywords, usedIds, allExercises);
      if (ex) {
        exercises.push({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group, category: ex.category, slot });
        usedIds.add(ex.id);
      }
    }

    phases.push({
      phase: p + 1,
      day_start: p * 14 + 1,
      day_end: p === 3 ? 60 : (p + 1) * 14,
      week1_reps: 100,
      week2_reps: 150,
      exercises
    });
  }

  return phases;
}

function getTodayPlan(userId, attemptId) {
  const setup = db.prepare('SELECT * FROM program_setup WHERE attempt_id=? AND user_id=?').get(attemptId, userId);
  if (!setup) return null;

  const attempt = db.prepare('SELECT * FROM program_attempts WHERE id=?').get(attemptId);
  if (!attempt) return null;

  const startDate = attempt.started_at.split(' ')[0];
  const today = new Date().toISOString().split('T')[0];
  const start = new Date(startDate);
  const todayDate = new Date(today);
  const currentDay = Math.floor((todayDate - start) / 86400000) + 1;

  if (currentDay < 1 || currentDay > 60) return null;

  const phases = JSON.parse(setup.phases_json);
  const phase = phases.find(p => currentDay >= p.day_start && currentDay <= p.day_end);
  if (!phase) return null;

  const dayInPhase = currentDay - phase.day_start + 1;
  const weekInPhase = dayInPhase <= 7 ? 1 : 2;
  const targetReps = weekInPhase === 1 ? phase.week1_reps : phase.week2_reps;

  const todayDone = db.prepare('SELECT 1 FROM workout_logs WHERE user_id=? AND date(logged_at)=? LIMIT 1').get(userId, today);

  return {
    current_day: currentDay,
    phase_number: phase.phase,
    day_in_phase: dayInPhase,
    week_in_phase: weekInPhase,
    target_reps: targetReps,
    exercises: phase.exercises,
    today_done: !!todayDone,
    today: today
  };
}

module.exports = { generatePhases, getTodayPlan };
