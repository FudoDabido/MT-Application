const db = require('../db/database');

function list(req, res, next) {
  try {
    const tasks = db.prepare(
      `SELECT * FROM custom_tasks WHERE user_id=? ORDER BY time_of_day, sort_order, id`
    ).all(req.user.id);
    res.json(tasks);
  } catch (e) { next(e); }
}

function create(req, res, next) {
  try {
    const { name, icon = '📌', duration_mins = 15, time_of_day, sort_order = 0 } = req.body;
    if (!name || !time_of_day) return res.status(400).json({ error: 'name and time_of_day required' });
    if (!['morning', 'evening'].includes(time_of_day)) return res.status(400).json({ error: 'time_of_day must be morning or evening' });
    const result = db.prepare(
      `INSERT INTO custom_tasks (user_id, name, icon, duration_mins, time_of_day, sort_order) VALUES (?,?,?,?,?,?)`
    ).run(req.user.id, name, icon, duration_mins, time_of_day, sort_order);
    const task = db.prepare(`SELECT * FROM custom_tasks WHERE id=?`).get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (e) { next(e); }
}

function update(req, res, next) {
  try {
    const { id } = req.params;
    const task = db.prepare(`SELECT * FROM custom_tasks WHERE id=? AND user_id=?`).get(id, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { name, icon, duration_mins, time_of_day, sort_order } = req.body;
    db.prepare(`
      UPDATE custom_tasks SET
        name=COALESCE(?,name), icon=COALESCE(?,icon),
        duration_mins=COALESCE(?,duration_mins), time_of_day=COALESCE(?,time_of_day),
        sort_order=COALESCE(?,sort_order)
      WHERE id=?
    `).run(name ?? null, icon ?? null, duration_mins ?? null, time_of_day ?? null, sort_order ?? null, id);
    res.json(db.prepare(`SELECT * FROM custom_tasks WHERE id=?`).get(id));
  } catch (e) { next(e); }
}

function remove(req, res, next) {
  try {
    const { id } = req.params;
    const task = db.prepare(`SELECT id FROM custom_tasks WHERE id=? AND user_id=?`).get(id, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    db.prepare(`DELETE FROM custom_tasks WHERE id=?`).run(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

module.exports = { list, create, update, remove };
