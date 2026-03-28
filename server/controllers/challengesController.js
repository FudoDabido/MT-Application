const db = require('../db/database');

function searchUser(req, res, next) {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const user = db.prepare(`SELECT id, name, username FROM users WHERE username=? AND id != ?`).get(username, req.user.id);
    res.json({ user: user || null });
  } catch (err) { next(err); }
}

function sendChallenge(req, res, next) {
  try {
    const challengerId = req.user.id;
    const { challenged_id, duration_days = 7 } = req.body;
    if (!challenged_id) return res.status(400).json({ error: 'challenged_id required' });
    if (challenged_id === challengerId) return res.status(400).json({ error: 'Cannot challenge yourself' });

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const endDate  = new Date(Date.now() + (duration_days + 1) * 86400000).toISOString().split('T')[0];

    db.prepare(`INSERT INTO challenges (challenger_id, challenged_id, start_date, end_date) VALUES (?,?,?,?)`)
      .run(challengerId, challenged_id, tomorrow, endDate);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

function getChallenges(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    // Auto-expire old challenges
    db.prepare(`UPDATE challenges SET status='ended' WHERE status='active' AND end_date < ?`).run(today);

    const rows = db.prepare(`
      SELECT c.*,
        u1.name as challenger_name, u1.username as challenger_username,
        u2.name as challenged_name, u2.username as challenged_username
      FROM challenges c
      JOIN users u1 ON u1.id = c.challenger_id
      JOIN users u2 ON u2.id = c.challenged_id
      WHERE (c.challenger_id=? OR c.challenged_id=?) AND c.status='active'
      ORDER BY c.created_at DESC
    `).all(userId, userId);

    // Compute scores: count days where all 4 habits were done
    const challenges = rows.map(c => {
      function countScore(uid) {
        const days = db.prepare(`
          SELECT date FROM training_checkins WHERE user_id=? AND status='completed' AND date BETWEEN ? AND ?
        `).all(uid, c.start_date, c.end_date).map(r => r.date);
        return days.length;
      }
      return {
        ...c,
        my_score:    countScore(userId),
        their_score: countScore(userId === c.challenger_id ? c.challenged_id : c.challenger_id),
      };
    });

    res.json({ challenges });
  } catch (err) { next(err); }
}

module.exports = { searchUser, sendChallenge, getChallenges };
