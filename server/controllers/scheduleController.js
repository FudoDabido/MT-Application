const db = require('../db/database');

// ── Time helpers ─────────────────────────────────────────────────────────────
function addMins(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function calcSchedule(leaveTime, returnTime, userId) {
  if (!leaveTime) return {};
  // Sum custom morning tasks for this user
  let customMorningMins = 0;
  try {
    const row = db.prepare(
      "SELECT COALESCE(SUM(duration_mins),0) as total FROM custom_tasks WHERE user_id=? AND time_of_day='morning'"
    ).get(userId);
    customMorningMins = row?.total || 0;
  } catch(e) {}
  // Mandatory: cold plunge 10 + training 60 + shower 15 = 85 + 15 buffer = 100
  const totalMorning    = 100 + customMorningMins;
  const wake            = addMins(leaveTime, -totalMorning);
  const cold_plunge     = wake;
  const train_time      = addMins(wake, 10);
  const shower_time     = addMins(train_time, 60);
  const bedtime         = addMins(wake, -(7 * 60));
  const stretch_time    = addMins(bedtime, -65);
  return { wake_time: wake, cold_plunge_time: cold_plunge, train_time, shower_time, bedtime, stretch_time };
}

// GET /api/schedule/:date
function getDay(req, res, next) {
  try {
    const userId = req.user.id;
    const { date } = req.params;

    // Get override for this day
    const override = db.prepare(
      `SELECT * FROM day_plans WHERE user_id=? AND date=?`
    ).get(userId, date);

    // Get default schedule from latest active program_setup
    const setup = db.prepare(
      `SELECT ps.* FROM program_setup ps
       JOIN program_attempts pa ON pa.id = ps.attempt_id
       WHERE ps.user_id=? AND pa.status='active'
       ORDER BY pa.id DESC LIMIT 1`
    ).get(userId);

    const leaveTime  = override?.leave_time  ?? setup?.work_leave_time ?? null;
    const returnTime = override?.return_time ?? setup?.return_time ?? null;

    const userRow = db.prepare(`SELECT meditation_mode FROM users WHERE id=?`).get(userId);
    const meditationMode = userRow?.meditation_mode || '1h_morning';

    const schedule = calcSchedule(leaveTime, returnTime, userId);
    const isCustom = !!(override?.leave_time || override?.return_time);

    const todos = db.prepare(
      `SELECT * FROM todos WHERE user_id=? AND date=? ORDER BY remind_at ASC, id ASC`
    ).all(userId, date);

    res.json({
      date,
      leave_time: leaveTime,
      return_time: returnTime,
      schedule,
      is_custom: isCustom,
      notes: override?.notes ?? null,
      todos,
      has_default: !!setup,
      meditation_mode: meditationMode,
      shower: {
        started_at:   override?.shower_started_at   ?? null,
        completed_at: override?.shower_completed_at ?? null,
      },
      work: {
        started_at:   override?.arrived_work_at    ?? null,
        paused_secs:  override?.work_paused_secs   ?? 0,
        paused_since: override?.work_paused_since  ?? null,
        completed_at: override?.left_work_at       ?? null,
      },
      home: {
        arrived_at: override?.arrived_home_at ?? null,
        late:       !!(override?.home_late),
      },
      cold_plunge_done_at: override?.cold_plunge_done_at ?? null,
    });
  } catch (err) { next(err); }
}

// PUT /api/schedule/:date
function upsertDay(req, res, next) {
  try {
    const userId = req.user.id;
    const { date } = req.params;
    const { leave_time, return_time, notes } = req.body;

    db.prepare(`
      INSERT INTO day_plans (user_id, date, leave_time, return_time, notes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        leave_time=excluded.leave_time,
        return_time=excluded.return_time,
        notes=excluded.notes
    `).run(userId, date, leave_time || null, return_time || null, notes || null);

    res.json({ ok: true });
  } catch (err) { next(err); }
}

// DELETE /api/schedule/:date — remove override (revert to defaults)
function deleteDay(req, res, next) {
  try {
    const userId = req.user.id;
    const { date } = req.params;
    db.prepare(`DELETE FROM day_plans WHERE user_id=? AND date=?`).run(userId, date);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// POST /api/schedule/todos
function createTodo(req, res, next) {
  try {
    const userId = req.user.id;
    const { date, text, remind_at } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });
    const r = db.prepare(
      `INSERT INTO todos (user_id, date, text, remind_at) VALUES (?, ?, ?, ?)`
    ).run(userId, date, text.trim(), remind_at || null);
    const todo = db.prepare(`SELECT * FROM todos WHERE id=?`).get(r.lastInsertRowid);
    res.json(todo);
  } catch (err) { next(err); }
}

// PUT /api/schedule/todos/:id
function updateTodo(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { text, completed, remind_at } = req.body;

    const todo = db.prepare(`SELECT * FROM todos WHERE id=? AND user_id=?`).get(id, userId);
    if (!todo) return res.status(404).json({ error: 'not found' });

    db.prepare(`
      UPDATE todos SET
        text = COALESCE(?, text),
        completed = COALESCE(?, completed),
        remind_at = CASE WHEN ? IS NOT NULL THEN ? ELSE remind_at END
      WHERE id=? AND user_id=?
    `).run(
      text ?? null, completed ?? null,
      remind_at !== undefined ? 1 : null, remind_at ?? null,
      id, userId
    );

    const updated = db.prepare(`SELECT * FROM todos WHERE id=?`).get(id);
    res.json(updated);
  } catch (err) { next(err); }
}

// DELETE /api/schedule/todos/:id
function deleteTodo(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    db.prepare(`DELETE FROM todos WHERE id=? AND user_id=?`).run(id, userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Generic timestamp check-in ────────────────────────────────────────────────
function makeCheckin(column) {
  return function(req, res, next) {
    try {
      const userId = req.user.id;
      const today  = new Date().toISOString().split('T')[0];
      const now    = new Date().toISOString();
      db.prepare(`INSERT OR IGNORE INTO day_plans (user_id, date) VALUES (?, ?)`).run(userId, today);
      db.prepare(`UPDATE day_plans SET ${column}=? WHERE user_id=? AND date=?`).run(now, userId, today);
      const row = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
      res.json({ ok: true, row });
    } catch (err) { next(err); }
  };
}

const coldPlungeDone = makeCheckin('cold_plunge_done_at');
const showerStart    = makeCheckin('shower_started_at');
const showerComplete = makeCheckin('shower_completed_at');

// ── Work timer ────────────────────────────────────────────────────────────────
function workStart(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const now    = new Date().toISOString();
    db.prepare(`INSERT OR IGNORE INTO day_plans (user_id, date) VALUES (?, ?)`).run(userId, today);
    const row = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    if (row?.arrived_work_at) return res.json({ ok: true, row }); // already started
    db.prepare(`UPDATE day_plans SET arrived_work_at=?, work_paused_secs=0, work_paused_since=NULL WHERE user_id=? AND date=?`).run(now, userId, today);
    const updated = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    res.json({ ok: true, row: updated });
  } catch (err) { next(err); }
}

function workPause(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const now    = new Date().toISOString();
    const row    = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    if (!row?.arrived_work_at || row?.left_work_at || row?.work_paused_since) return res.json({ ok: false, msg: 'invalid state' });
    db.prepare(`UPDATE day_plans SET work_paused_since=? WHERE user_id=? AND date=?`).run(now, userId, today);
    const updated = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    res.json({ ok: true, row: updated });
  } catch (err) { next(err); }
}

function workResume(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const now    = new Date().toISOString();
    const row    = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    if (!row?.work_paused_since) return res.json({ ok: false, msg: 'not paused' });
    const addedSecs = Math.floor((new Date(now) - new Date(row.work_paused_since)) / 1000);
    const newPausedSecs = (row.work_paused_secs || 0) + addedSecs;
    db.prepare(`UPDATE day_plans SET work_paused_since=NULL, work_paused_secs=? WHERE user_id=? AND date=?`).run(newPausedSecs, userId, today);
    const updated = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    res.json({ ok: true, row: updated });
  } catch (err) { next(err); }
}

function workCheckout(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const now    = new Date().toISOString();
    const row    = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    if (!row?.arrived_work_at) return res.status(400).json({ error: 'work not started' });
    // Finalize any open pause
    let finalPausedSecs = row.work_paused_secs || 0;
    if (row.work_paused_since) {
      finalPausedSecs += Math.floor((new Date(now) - new Date(row.work_paused_since)) / 1000);
    }
    db.prepare(`UPDATE day_plans SET left_work_at=?, work_paused_secs=?, work_paused_since=NULL WHERE user_id=? AND date=?`).run(now, finalPausedSecs, userId, today);
    const updated = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    res.json({ ok: true, row: updated });
  } catch (err) { next(err); }
}

// ── Home arrival with late penalty ────────────────────────────────────────────
function homeArrive(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const now    = new Date().toISOString();

    db.prepare(`INSERT OR IGNORE INTO day_plans (user_id, date) VALUES (?, ?)`).run(userId, today);

    // Get return_time (from override or program setup)
    const row   = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    const setup = db.prepare(`
      SELECT ps.return_time FROM program_setup ps
      JOIN program_attempts pa ON pa.id = ps.attempt_id
      WHERE ps.user_id=? AND pa.status='active' ORDER BY pa.id DESC LIMIT 1
    `).get(userId);
    const returnTime = row?.return_time ?? setup?.return_time ?? null;

    let isLate = 0;
    if (returnTime) {
      const [rh, rm] = returnTime.split(':').map(Number);
      const nowD = new Date();
      const nowMins  = nowD.getHours() * 60 + nowD.getMinutes();
      const retMins  = rh * 60 + rm;
      if (nowMins - retMins > 30) isLate = 1;
    }

    db.prepare(`UPDATE day_plans SET arrived_home_at=?, home_late=? WHERE user_id=? AND date=?`).run(now, isLate, userId, today);
    const updated = db.prepare(`SELECT * FROM day_plans WHERE user_id=? AND date=?`).get(userId, today);
    res.json({ ok: true, row: updated, late: !!isLate });
  } catch (err) { next(err); }
}

module.exports = {
  getDay, upsertDay, deleteDay, createTodo, updateTodo, deleteTodo,
  coldPlungeDone, showerStart, showerComplete,
  workStart, workPause, workResume, workCheckout, homeArrive,
};
