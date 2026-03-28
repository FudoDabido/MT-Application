const db = require('../db/database');

// ── Diary Entries ─────────────────────────────────────────────────────────────

function getEntry(req, res, next) {
  try {
    const entry = db.prepare(
      `SELECT * FROM diary_entries WHERE user_id=? AND date=?`
    ).get(req.user.id, req.params.date);
    res.json({ entry: entry ?? null });
  } catch (err) { next(err); }
}

function listEntries(req, res, next) {
  try {
    const rows = db.prepare(
      `SELECT date, locked FROM diary_entries WHERE user_id=? ORDER BY date DESC LIMIT 90`
    ).all(req.user.id);
    res.json({ entries: rows });
  } catch (err) { next(err); }
}

function upsertEntry(req, res, next) {
  try {
    const { date } = req.params;
    const userId   = req.user.id;
    const existing = db.prepare(`SELECT locked FROM diary_entries WHERE user_id=? AND date=?`).get(userId, date);
    if (existing?.locked) return res.status(403).json({ error: 'Entry is locked' });

    const { did_best, what_did, proud, do_better, notes } = req.body;

    db.prepare(`
      INSERT INTO diary_entries (user_id, date, did_best, what_did, proud, do_better, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        did_best=excluded.did_best, what_did=excluded.what_did,
        proud=excluded.proud, do_better=excluded.do_better,
        notes=excluded.notes, updated_at=datetime('now')
    `).run(userId, date, did_best ?? null, what_did ?? null, proud ?? null, do_better ?? null, notes ?? null);

    const entry = db.prepare(`SELECT * FROM diary_entries WHERE user_id=? AND date=?`).get(userId, date);
    res.json({ entry });
  } catch (err) { next(err); }
}

function lockEntry(req, res, next) {
  try {
    const { date } = req.params;
    const userId   = req.user.id;
    const existing = db.prepare(`SELECT id, locked FROM diary_entries WHERE user_id=? AND date=?`).get(userId, date);
    if (!existing) return res.status(404).json({ error: 'No entry for this date' });
    if (existing.locked) return res.status(409).json({ error: 'Already locked' });

    db.prepare(`UPDATE diary_entries SET locked=1, updated_at=datetime('now') WHERE id=?`).run(existing.id);
    res.json({ locked: true });
  } catch (err) { next(err); }
}

// ── Lessons ───────────────────────────────────────────────────────────────────

function getLessons(req, res, next) {
  try {
    const userId = req.user.id;
    const q      = req.query.q?.trim();
    const rows   = q
      ? db.prepare(`SELECT * FROM lessons WHERE user_id=? AND (title LIKE ? OR topic LIKE ?) ORDER BY created_at DESC`).all(userId, `%${q}%`, `%${q}%`)
      : db.prepare(`SELECT * FROM lessons WHERE user_id=? ORDER BY created_at DESC`).all(userId);
    res.json({ lessons: rows });
  } catch (err) { next(err); }
}

function createLesson(req, res, next) {
  try {
    const { title, topic, content } = req.body;
    if (!title?.trim() || !topic?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'title, topic and content are required' });
    }
    const result = db.prepare(
      `INSERT INTO lessons (user_id, title, topic, content) VALUES (?,?,?,?)`
    ).run(req.user.id, title.trim(), topic.trim(), content.trim());
    const lesson = db.prepare(`SELECT * FROM lessons WHERE id=?`).get(result.lastInsertRowid);
    res.status(201).json({ lesson });
  } catch (err) { next(err); }
}

module.exports = { getEntry, listEntries, upsertEntry, lockEntry, getLessons, createLesson };
