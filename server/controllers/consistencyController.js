const db = require('../db/database');

function getScore(req, res, next) {
  try {
    const userId = req.user.id;

    // Get active attempt
    const attempt = db.prepare(`SELECT * FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`).get(userId);
    if (!attempt) return res.json({ consistency: 0, pertinence: 0, breakdown: {} });

    const startDate = attempt.started_at.split(' ')[0];
    const today = new Date().toISOString().split('T')[0];

    // Days elapsed since program start (not including future)
    const start = new Date(startDate);
    const todayDate = new Date(today);
    const daysElapsed = Math.max(1, Math.floor((todayDate - start) / 86400000) + 1);

    // Training: count distinct days with workout logs
    const trainedDays = db.prepare(`
      SELECT COUNT(DISTINCT date(logged_at)) as cnt
      FROM workout_logs
      WHERE user_id=? AND date(logged_at) >= ? AND date(logged_at) <= ?
    `).get(userId, startDate, today);

    // Meditation: count passed sessions
    const meditationPassed = db.prepare(`
      SELECT COUNT(*) as cnt FROM meditation_sessions
      WHERE user_id=? AND date >= ? AND date <= ? AND status='passed'
    `).get(userId, startDate, today);

    const meditationTotal = db.prepare(`
      SELECT COUNT(*) as cnt FROM meditation_sessions
      WHERE user_id=? AND date >= ? AND date <= ?
    `).get(userId, startDate, today);

    // Videos: count workout logs with videos
    const logsWithVideo = db.prepare(`
      SELECT COUNT(*) as cnt FROM workout_logs
      WHERE user_id=? AND date(logged_at) >= ? AND video_path IS NOT NULL
    `).get(userId, startDate, today);

    const totalLogs = db.prepare(`
      SELECT COUNT(*) as cnt FROM workout_logs
      WHERE user_id=? AND date(logged_at) >= ?
    `).get(userId, startDate);

    const trainRate = daysElapsed > 0 ? (trainedDays.cnt / Math.min(daysElapsed, 60)) * 100 : 0;
    const meditationRate = meditationTotal.cnt > 0 ? (meditationPassed.cnt / meditationTotal.cnt) * 100 : 0;

    // Consistency = weighted average: 60% training rate + 40% meditation rate
    const consistency = Math.round(trainRate * 0.6 + meditationRate * 0.4);

    // Pertinence = video posting rate (how verifiable are your workouts)
    const pertinence = totalLogs.cnt > 0 ? Math.round((logsWithVideo.cnt / totalLogs.cnt) * 100) : 0;

    res.json({
      consistency: Math.min(100, consistency),
      pertinence,
      breakdown: {
        days_trained: trainedDays.cnt,
        days_elapsed: Math.min(daysElapsed, 60),
        train_rate: Math.round(trainRate),
        meditation_passed: meditationPassed.cnt,
        meditation_total: meditationTotal.cnt,
        meditation_rate: Math.round(meditationRate),
        logs_with_video: logsWithVideo.cnt,
        total_logs: totalLogs.cnt,
      }
    });
  } catch(err) { next(err); }
}

module.exports = { getScore };
