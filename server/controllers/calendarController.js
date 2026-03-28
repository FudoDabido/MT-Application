const db = require('../db/database');

// ── Existing: workout log view per month ──────────────────────────────────────
function getMonth(req, res, next) {
  try {
    const userId = req.user.id;
    const { yearMonth } = req.params;
    // Combine free workout_logs AND program training_checkins
    const rows = db.prepare(`
      SELECT d FROM (
        SELECT date(logged_at) as d FROM workout_logs
          WHERE user_id=? AND strftime('%Y-%m', logged_at)=?
        UNION
        SELECT date as d FROM training_checkins
          WHERE user_id=? AND strftime('%Y-%m', date)=? AND status='completed'
      ) GROUP BY d
    `).all(userId, yearMonth, userId, yearMonth);
    const workoutDays = new Set(rows.map(r => r.d));
    res.json({ workout_days: [...workoutDays] });
  } catch(err) { next(err); }
}

// ── Existing: workout log view per day ───────────────────────────────────────
function getDay(req, res, next) {
  try {
    const userId = req.user.id;
    const { date } = req.params;
    const workout_logs = db.prepare(`
      SELECT wl.id, wl.logged_at, wl.sets, wl.reps, wl.distance_km, wl.duration_secs, wl.weight_kg, wl.notes,
             et.name as exercise_name, et.category, et.muscle_group
      FROM workout_logs wl
      JOIN exercise_types et ON et.id = wl.exercise_type_id
      WHERE wl.user_id=? AND date(wl.logged_at)=?
      UNION ALL
      SELECT tel.id, tel.logged_at, NULL as sets, tel.reps_done as reps,
             NULL as distance_km, NULL as duration_secs, tel.weight_kg, NULL as notes,
             tel.exercise_name, et.category, et.muscle_group
      FROM training_exercise_logs tel
      LEFT JOIN exercise_types et ON et.id = tel.exercise_type_id
      JOIN training_checkins tc ON tc.id = tel.checkin_id
      WHERE tel.user_id=? AND tc.date=? AND tc.status='completed'
      ORDER BY logged_at ASC
    `).all(userId, date, userId, date);

    const events = db.prepare(`
      SELECT * FROM calendar_events
      WHERE user_id=? AND date=? AND is_canceled=0
      ORDER BY time ASC
    `).all(userId, date);

    res.json({ date, logs: workout_logs, workout_logs, events });
  } catch(err) { next(err); }
}

// ── Helper: expand repeating events for a given month ────────────────────────
function expandEvents(rows, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const monthStart = `${yearMonth}-01`;
  const monthEnd   = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
  const expanded = [];

  for (const ev of rows) {
    if (ev.repeat_type === 'none') {
      expanded.push(ev);
    } else if (ev.repeat_type === 'daily') {
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
        if (dateStr >= ev.date) expanded.push({ ...ev, date: dateStr });
      }
    } else if (ev.repeat_type === 'weekly') {
      const evDow = new Date(ev.date + 'T12:00:00').getDay();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
        if (dateStr >= ev.date && new Date(dateStr + 'T12:00:00').getDay() === evDow) {
          expanded.push({ ...ev, date: dateStr });
        }
      }
    } else if (ev.repeat_type === 'monthly') {
      const evDay = ev.date.split('-')[2];
      const dayNum = parseInt(evDay);
      if (dayNum <= daysInMonth) {
        const dateStr = `${yearMonth}-${evDay}`;
        if (dateStr >= ev.date) expanded.push({ ...ev, date: dateStr });
      }
    } else if (ev.repeat_type === 'yearly') {
      const [, evM, evD] = ev.date.split('-');
      if (parseInt(evM) === month) {
        const dateStr = `${year}-${evM}-${evD}`;
        if (dateStr >= ev.date) expanded.push({ ...ev, date: dateStr });
      }
    }
  }

  expanded.sort((a, b) => {
    const ka = a.date + (a.time || '24:00');
    const kb = b.date + (b.time || '24:00');
    return ka < kb ? -1 : 1;
  });
  return expanded;
}

// GET /api/calendar/events/:yearMonth  →  events expanded for that month
function getEvents(req, res, next) {
  try {
    const userId = req.user.id;
    const { yearMonth } = req.params;
    const [y, m] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthEnd = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;

    const rows = db.prepare(`
      SELECT * FROM calendar_events
      WHERE user_id=? AND (
        repeat_type IN ('monthly','yearly','weekly') OR
        (repeat_type='none'  AND date <= ? AND date >= ?) OR
        (repeat_type='daily' AND date <= ?)
      )
      ORDER BY time
    `).all(userId, monthEnd, `${yearMonth}-01`, monthEnd);

    res.json({ events: expandEvents(rows, y, m) });
  } catch(err) { next(err); }
}

// POST /api/calendar/events
function createEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { title, date, time, duration_mins, notes, color, remind_mins, repeat_type, event_type } = req.body;
    if (!title?.trim() || !date) return res.status(400).json({ error: 'title and date required' });
    const result = db.prepare(`
      INSERT INTO calendar_events (user_id, title, date, time, duration_mins, notes, color, remind_mins, repeat_type, event_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, title.trim(), date,
      time || null, duration_mins || null, notes?.trim() || null,
      color || 'emerald', remind_mins || 0, repeat_type || 'none',
      event_type || 'appointment'
    );
    const ev = db.prepare('SELECT * FROM calendar_events WHERE id=?').get(result.lastInsertRowid);
    res.json({ event: ev });
  } catch(err) { next(err); }
}

// PUT /api/calendar/events/:id
function updateEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const ev = db.prepare('SELECT * FROM calendar_events WHERE id=? AND user_id=?').get(id, userId);
    if (!ev) return res.status(404).json({ error: 'Not found' });
    const { title, date, time, duration_mins, notes, color, remind_mins, repeat_type } = req.body;
    db.prepare(`
      UPDATE calendar_events SET
        title=?, date=?, time=?, duration_mins=?, notes=?, color=?, remind_mins=?, repeat_type=?
      WHERE id=? AND user_id=?
    `).run(
      title?.trim() ?? ev.title,
      date ?? ev.date,
      time !== undefined ? (time || null) : ev.time,
      duration_mins !== undefined ? (duration_mins || null) : ev.duration_mins,
      notes !== undefined ? (notes?.trim() || null) : ev.notes,
      color ?? ev.color,
      remind_mins !== undefined ? remind_mins : ev.remind_mins,
      repeat_type ?? ev.repeat_type,
      id, userId
    );
    const updated = db.prepare('SELECT * FROM calendar_events WHERE id=?').get(id);
    res.json({ event: updated });
  } catch(err) { next(err); }
}

// DELETE /api/calendar/events/:id
function deleteEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    db.prepare('DELETE FROM calendar_events WHERE id=? AND user_id=?').run(id, userId);
    res.json({ ok: true });
  } catch(err) { next(err); }
}

function cancelEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const event = db.prepare(`SELECT id FROM calendar_events WHERE id=? AND user_id=?`).get(id, userId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    db.prepare(`UPDATE calendar_events SET is_canceled=1 WHERE id=?`).run(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { getMonth, getDay, getEvents, createEvent, updateEvent, deleteEvent, cancelEvent };
