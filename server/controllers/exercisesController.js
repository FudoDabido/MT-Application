const db = require('../db/database');

function listExercises(req, res, next) {
  try {
    const rows = db.prepare(`
      SELECT * FROM exercise_types WHERE is_system=1 OR created_by=?
      ORDER BY is_system DESC, name ASC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

function createExercise(req, res, next) {
  try {
    const { name, category } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });
    const result = db.prepare('INSERT INTO exercise_types (name, category, is_system, created_by) VALUES (?, ?, 0, ?)').run(name, category, req.user.id);
    const ex = db.prepare('SELECT * FROM exercise_types WHERE id=?').get(result.lastInsertRowid);
    res.status(201).json(ex);
  } catch (err) {
    next(err);
  }
}

module.exports = { listExercises, createExercise };
