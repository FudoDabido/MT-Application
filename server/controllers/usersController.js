const db = require('../db/database');

function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    if (parseInt(id) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { name, birth_date, initial_weight, initial_height } = req.body;
    db.prepare(`
      UPDATE users SET name=COALESCE(?,name), birth_date=COALESCE(?,birth_date),
      initial_weight=COALESCE(?,initial_weight), initial_height=COALESCE(?,initial_height),
      updated_at=datetime('now') WHERE id=?
    `).run(name || null, birth_date || null, initial_weight || null, initial_height || null, id);
    const user = db.prepare('SELECT id, name, email, birth_date, initial_weight, initial_height, photo_path, created_at FROM users WHERE id=?').get(id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

function uploadPhoto(req, res, next) {
  try {
    const { id } = req.params;
    if (parseInt(id) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const photoPath = `uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET photo_path=?, updated_at=datetime(\'now\') WHERE id=?').run(photoPath, id);
    res.json({ photo_path: photoPath });
  } catch (err) {
    next(err);
  }
}

module.exports = { updateUser, uploadPhoto };
