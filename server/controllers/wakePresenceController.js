const db = require('../db/database');

const WINDOW_MINS = 3;

function getSetup(userId) {
  return db.prepare(`
    SELECT ps.wake_time, ps.bedtime FROM program_setup ps
    JOIN program_attempts pa ON pa.id = ps.attempt_id
    WHERE pa.user_id = ? AND pa.status = 'active'
    ORDER BY pa.id DESC LIMIT 1
  `).get(userId);
}

function getToday(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    const setup = getSetup(userId);
    if (!setup?.wake_time) return res.json({ record: null, wake_time: null, bed_time: null });

    const wakeTime = setup.wake_time;
    const bedTime  = setup.bedtime ?? null;

    // Don't track today if the program hasn't started yet
    const attempt = db.prepare(`
      SELECT started_at FROM program_attempts WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1
    `).get(userId);
    if (attempt && attempt.started_at > today) {
      return res.json({ record: null, wake_time: wakeTime, bed_time: bedTime, starts_on: attempt.started_at });
    }

    db.prepare(`
      INSERT OR IGNORE INTO wake_presence (user_id, date, scheduled_wake, status)
      VALUES (?, ?, ?, 'pending')
    `).run(userId, today, wakeTime);

    const record = db.prepare(`SELECT * FROM wake_presence WHERE user_id = ? AND date = ?`).get(userId, today);

    // Auto-fail any previous days still pending
    db.prepare(`
      UPDATE wake_presence SET status = 'failed'
      WHERE user_id = ? AND date < ? AND status = 'pending'
    `).run(userId, today);

    res.json({ record, wake_time: wakeTime, bed_time: bedTime });
  } catch (err) { next(err); }
}

function clockIn(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    let record = db.prepare(`SELECT * FROM wake_presence WHERE user_id = ? AND date = ?`).get(userId, today);
    if (!record) return res.status(404).json({ error: 'No presence record for today' });
    if (record.clocked_in_at) return res.status(409).json({ error: 'Already clocked in' });

    const [wh, wm] = record.scheduled_wake.split(':').map(Number);
    const now       = new Date();
    const windowEnd = new Date(now);
    windowEnd.setHours(wh, wm + WINDOW_MINS, 0, 0);
    const isLate    = now > windowEnd ? 1 : 0;

    db.prepare(`
      UPDATE wake_presence SET status = 'passed', clocked_in_at = datetime('now'), late_wakeup = ?
      WHERE id = ?
    `).run(isLate, record.id);

    record = db.prepare(`SELECT * FROM wake_presence WHERE id = ?`).get(record.id);
    res.json({ record });
  } catch (err) { next(err); }
}

function clockOut(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    let record = db.prepare(`SELECT * FROM wake_presence WHERE user_id = ? AND date = ?`).get(userId, today);
    if (!record) {
      const setup = getSetup(userId);
      if (!setup?.wake_time) return res.status(400).json({ error: 'No active program' });
      db.prepare(`
        INSERT OR IGNORE INTO wake_presence (user_id, date, scheduled_wake, status)
        VALUES (?, ?, ?, 'pending')
      `).run(userId, today, setup.wake_time);
      record = db.prepare(`SELECT * FROM wake_presence WHERE user_id = ? AND date = ?`).get(userId, today);
    }

    db.prepare(`UPDATE wake_presence SET clocked_out_at = datetime('now') WHERE id = ?`).run(record.id);
    record = db.prepare(`SELECT * FROM wake_presence WHERE id = ?`).get(record.id);
    res.json({ record });
  } catch (err) { next(err); }
}

function getStats(req, res, next) {
  try {
    const userId = req.user.id;
    const all = db.prepare(`SELECT * FROM wake_presence WHERE user_id = ? ORDER BY date DESC`).all(userId);
    const total  = all.length;
    const passed = all.filter(r => r.status === 'passed').length;
    const failed = all.filter(r => r.status === 'failed').length;
    let streak = 0;
    for (const r of all) {
      if (r.status === 'passed') streak++;
      else break;
    }
    let best = 0, cur = 0;
    for (const r of [...all].reverse()) {
      if (r.status === 'passed') { cur++; best = Math.max(best, cur); }
      else cur = 0;
    }
    res.json({ total, passed, failed, streak, best_streak: best });
  } catch (err) { next(err); }
}

module.exports = { getToday, clockIn, clockOut, getStats };
