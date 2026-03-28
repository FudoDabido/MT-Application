const webpush = require('web-push');
const db = require('../db/database');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || 'BPUT55F6ugVK3TjSqcEYHZwNzHMpo8_82P6Xbk2cUJ0TWir0L16ulpWJAfWTDlRKBniR4aZXpTsNnbKnLSXU7dM';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || '4H8mFc26S2l95icDacxTL8kwgGSH5LYQURBFyRgRpZk';
const VAPID_EMAIL   = process.env.VAPID_EMAIL   || 'mailto:admin@mt-app.local';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

function getVapidPublicKey(req, res) {
  res.json({ key: VAPID_PUBLIC });
}

function savePushSubscription(req, res, next) {
  try {
    const userId = req.user.id;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' });
    db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
      VALUES (?,?,?,?)
      ON CONFLICT(user_id, endpoint) DO UPDATE SET keys_p256dh=excluded.keys_p256dh, keys_auth=excluded.keys_auth
    `).run(userId, endpoint, keys.p256dh, keys.auth);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function deletePushSubscription(req, res, next) {
  try {
    const userId = req.user.id;
    db.prepare(`DELETE FROM push_subscriptions WHERE user_id=?`).run(userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

let lastNotifyHour = -1;

async function checkAndNotifyUsers() {
  const now = new Date();
  const hour = now.getHours();
  const min  = now.getMinutes();

  // Only run in the 21:00–21:10 window, once per hour
  if (hour !== 21 || min > 10 || lastNotifyHour === hour) return;
  lastNotifyHour = hour;

  const today = now.toISOString().split('T')[0];
  const subs  = db.prepare(`SELECT * FROM push_subscriptions`).all();

  for (const sub of subs) {
    const userId = sub.user_id;

    // Check which habits are incomplete today
    const incomplete = [];
    const medit  = db.prepare(`SELECT * FROM meditation_sessions WHERE user_id=? AND date=? AND status='passed'`).get(userId, today);
    const stretch = db.prepare(`SELECT * FROM stretch_checkins WHERE user_id=? AND date=? AND status='completed'`).get(userId, today);
    const diary   = db.prepare(`SELECT * FROM diary_entries WHERE user_id=? AND date=?`).get(userId, today);

    if (!medit)   incomplete.push('Meditation');
    if (!stretch) incomplete.push('Stretching');
    if (!diary)   incomplete.push('Diary');

    if (!incomplete.length) continue;

    const payload = JSON.stringify({
      title: '⚠ Streak at risk!',
      body:  `Still to do today: ${incomplete.join(', ')}`,
      url:   incomplete[0] === 'Diary' ? '/diary' : `/${incomplete[0].toLowerCase()}`,
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        payload
      );
    } catch (e) {
      if (e.statusCode === 410) {
        db.prepare(`DELETE FROM push_subscriptions WHERE id=?`).run(sub.id);
      }
    }
  }
}

// ── Per-minute reminder notifications ────────────────────────────────────────
async function sendPush(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    );
  } catch (e) {
    if (e.statusCode === 410) db.prepare(`DELETE FROM push_subscriptions WHERE id=?`).run(sub.id);
  }
}

async function checkReminderNotifications() {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const hh    = String(now.getHours()).padStart(2, '0');
  const mm    = String(now.getMinutes()).padStart(2, '0');
  const timeNow = `${hh}:${mm}`;

  // Find reminders due within this minute (time = HH:MM, date = today, not canceled)
  const due = db.prepare(`
    SELECT ce.*, ps.endpoint, ps.keys_p256dh, ps.keys_auth
    FROM calendar_events ce
    JOIN push_subscriptions ps ON ps.user_id = ce.user_id
    WHERE ce.event_type = 'reminder'
      AND ce.date = ?
      AND substr(ce.time, 1, 5) = ?
      AND ce.is_canceled = 0
  `).all(today, timeNow);

  for (const r of due) {
    await sendPush(r, {
      title: `🔔 ${r.title}`,
      body:  r.notes || 'Reminder',
      url:   '/schedule',
    });
  }
}

async function checkAllNotifications() {
  await checkAndNotifyUsers();
  await checkReminderNotifications();
}

module.exports = { getVapidPublicKey, savePushSubscription, deletePushSubscription, checkAndNotifyUsers: checkAllNotifications };
