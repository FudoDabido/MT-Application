const db = require('../db/database');

function getStatus(req, res, next) {
  try {
    const row = db.prepare('SELECT * FROM user_onboarding WHERE user_id=?').get(req.user.id);
    res.json({ completed: row ? row.completed === 1 : false, training_location: row?.training_location || null });
  } catch(err) { next(err); }
}

function getEquipment(req, res, next) {
  try {
    const items = db.prepare('SELECT * FROM equipment_items ORDER BY category, name').all();
    const categories = {};
    items.forEach(item => {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    });
    res.json({ items, categories });
  } catch(err) { next(err); }
}

function getUserEquipment(req, res, next) {
  try {
    const rows = db.prepare(`
      SELECT ue.*, ei.name, ei.category, ei.icon, ei.description
      FROM user_equipment ue
      JOIN equipment_items ei ON ei.id = ue.equipment_item_id
      WHERE ue.user_id = ?
    `).all(req.user.id);
    res.json(rows);
  } catch(err) { next(err); }
}

function completeOnboarding(req, res, next) {
  try {
    const { training_location, equipment_ids } = req.body;
    // Remove old equipment
    db.prepare('DELETE FROM user_equipment WHERE user_id=?').run(req.user.id);
    // Add new equipment
    if (Array.isArray(equipment_ids)) {
      const insert = db.prepare('INSERT OR IGNORE INTO user_equipment (user_id, equipment_item_id) VALUES (?, ?)');
      equipment_ids.forEach(id => insert.run(req.user.id, id));
    }
    // Mark onboarding complete
    db.prepare(`
      INSERT INTO user_onboarding (user_id, completed, training_location, completed_at)
      VALUES (?, 1, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET completed=1, training_location=excluded.training_location, completed_at=excluded.completed_at
    `).run(req.user.id, training_location || 'home');
    res.json({ success: true });
  } catch(err) { next(err); }
}

module.exports = { getStatus, getEquipment, getUserEquipment, completeOnboarding };
