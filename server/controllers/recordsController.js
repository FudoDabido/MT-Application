const db = require('../db/database');

function getRecords(req, res, next) {
  try {
    const rows = db.prepare(`
      SELECT pr.*, et.name as exercise_name, et.category
      FROM personal_records pr JOIN exercise_types et ON et.id=pr.exercise_type_id
      WHERE pr.user_id=? ORDER BY et.name ASC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getRecords };
