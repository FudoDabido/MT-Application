const db = require('../db/database');

const WINDOW_MINS = 10;

function isWithinWindow(scheduledTime) {
  const [sh, sm] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const windowStart = new Date(now); windowStart.setHours(sh, sm, 0, 0);
  const windowEnd   = new Date(now); windowEnd.setHours(sh, sm + WINDOW_MINS, 0, 0);
  return now >= windowStart && now <= windowEnd;
}

function windowPassed(scheduledTime) {
  const [sh, sm] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const windowEnd = new Date(now); windowEnd.setHours(sh, sm + WINDOW_MINS, 0, 0);
  return now > windowEnd;
}

function getToday(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Get active program setup for stretch_time
    const setup = db.prepare(`
      SELECT ps.stretch_time FROM program_setup ps
      JOIN program_attempts pa ON pa.id = ps.attempt_id
      WHERE pa.user_id = ? AND pa.status = 'active'
      ORDER BY pa.id DESC LIMIT 1
    `).get(userId);

    if (!setup || !setup.stretch_time) {
      return res.json({ checkin: null, stretch_time: null, exercises: [] });
    }

    const stretchTime = setup.stretch_time;

    // Don't track today if the program hasn't started yet
    const attempt = db.prepare(`
      SELECT started_at FROM program_attempts WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1
    `).get(userId);
    if (attempt && attempt.started_at > today) {
      const exercises = db.prepare(`SELECT id, name, muscle_group FROM exercise_types WHERE is_stretching = 1 ORDER BY id`).all();
      return res.json({ checkin: null, stretch_time: stretchTime, exercises, starts_on: attempt.started_at });
    }

    // Insert or ignore today's record
    db.prepare(`
      INSERT OR IGNORE INTO stretch_checkins (user_id, date, scheduled_time, status)
      VALUES (?, ?, ?, 'pending')
    `).run(userId, today, stretchTime);

    let checkin = db.prepare(`SELECT * FROM stretch_checkins WHERE user_id = ? AND date = ?`).get(userId, today);

    // Auto-fail if window passed and still pending
    if (checkin.status === 'pending' && windowPassed(stretchTime)) {
      db.prepare(`UPDATE stretch_checkins SET status = 'failed' WHERE id = ?`).run(checkin.id);
      checkin = db.prepare(`SELECT * FROM stretch_checkins WHERE id = ?`).get(checkin.id);
    }

    // Get all stretching exercises
    const exercises = db.prepare(`
      SELECT id, name, muscle_group FROM exercise_types WHERE is_stretching = 1 ORDER BY id
    `).all();

    res.json({ checkin, stretch_time: stretchTime, exercises });
  } catch (err) { next(err); }
}

function checkin(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const record = db.prepare(`SELECT * FROM stretch_checkins WHERE user_id = ? AND date = ?`).get(userId, today);
    if (!record) return res.status(404).json({ error: 'No stretch checkin record for today' });
    if (record.status !== 'pending') return res.status(409).json({ error: `Already ${record.status}` });

    if (!isWithinWindow(record.scheduled_time)) {
      if (windowPassed(record.scheduled_time)) {
        return res.status(400).json({ error: 'Check-in window has passed' });
      }
      return res.status(400).json({ error: 'Check-in window not open yet' });
    }

    db.prepare(`
      UPDATE stretch_checkins SET status = 'active', checked_in_at = datetime('now') WHERE id = ?
    `).run(record.id);

    const updated = db.prepare(`SELECT * FROM stretch_checkins WHERE id = ?`).get(record.id);
    res.json({ checkin: updated });
  } catch (err) { next(err); }
}

function completeStretch(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const checkin = db.prepare(`SELECT * FROM stretch_checkins WHERE user_id = ? AND date = ?`).get(userId, today);
    if (!checkin) return res.status(404).json({ error: 'No stretch checkin for today' });
    if (checkin.status !== 'active') return res.status(409).json({ error: `Cannot complete — status is ${checkin.status}` });

    db.prepare(`
      UPDATE stretch_checkins SET status = 'completed', completed_at = datetime('now') WHERE id = ?
    `).run(checkin.id);

    const updated = db.prepare(`SELECT * FROM stretch_checkins WHERE id = ?`).get(checkin.id);
    res.json({ checkin: updated });
  } catch (err) { next(err); }
}

function getStats(req, res, next) {
  try {
    const userId = req.user.id;
    const all = db.prepare(`SELECT * FROM stretch_checkins WHERE user_id = ? ORDER BY date DESC`).all(userId);

    const total  = all.length;
    const passed = all.filter(r => r.status === 'completed').length;
    const failed = all.filter(r => r.status === 'failed').length;

    // Current streak (consecutive completed days going back from most recent non-pending)
    let streak = 0;
    for (const r of all) {
      if (r.status === 'pending') continue;
      if (r.status === 'completed') streak++;
      else break;
    }

    // Best streak
    let best = 0, cur = 0;
    for (const r of [...all].reverse()) {
      if (r.status === 'pending') continue;
      if (r.status === 'completed') { cur++; best = Math.max(best, cur); }
      else cur = 0;
    }

    res.json({ total, passed, failed, streak, best_streak: best });
  } catch (err) { next(err); }
}

module.exports = { getToday, checkin, completeStretch, getStats };
