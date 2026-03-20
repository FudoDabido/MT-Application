const db = require('../db/database');

function updatePR(userId, exerciseTypeId, log) {
  const existing = db.prepare(
    'SELECT * FROM personal_records WHERE user_id=? AND exercise_type_id=?'
  ).get(userId, exerciseTypeId);

  const newReps = log.reps || null;
  const newSets = log.sets || null;
  const newDist = log.distance_km || null;
  const newDur = log.duration_secs || null;

  if (!existing) {
    db.prepare(`
      INSERT INTO personal_records (user_id, exercise_type_id, best_reps, best_sets, best_distance_km, best_duration_secs, log_id, achieved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(userId, exerciseTypeId, newReps, newSets, newDist, newDur, log.id);
    return;
  }

  const updates = {};
  if (newReps !== null && (existing.best_reps === null || newReps > existing.best_reps)) updates.best_reps = newReps;
  if (newSets !== null && (existing.best_sets === null || newSets > existing.best_sets)) updates.best_sets = newSets;
  if (newDist !== null && (existing.best_distance_km === null || newDist > existing.best_distance_km)) updates.best_distance_km = newDist;
  if (newDur !== null && (existing.best_duration_secs === null || newDur < existing.best_duration_secs)) updates.best_duration_secs = newDur; // lower is better for duration

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k}=?`).join(', ');
    const values = [...Object.values(updates), log.id, userId, exerciseTypeId];
    db.prepare(`UPDATE personal_records SET ${setClauses}, log_id=?, achieved_at=datetime('now') WHERE user_id=? AND exercise_type_id=?`).run(...values);
  }
}

module.exports = { updatePR };
