const db = require('../db/database');

function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    if (parseInt(id) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { name, birth_date, initial_weight, initial_height } = req.body;
    db.prepare(`
      UPDATE users SET name=COALESCE(?,name), birth_date=COALESCE(?,birth_date),
      initial_weight=COALESCE(?,initial_weight), initial_height=COALESCE(?,initial_height),
      updated_at=datetime('now') WHERE id=?
    `).run(name || null, birth_date || null, initial_weight || null, initial_height || null, id);
    const user = db.prepare('SELECT id, name, email, birth_date, initial_weight, initial_height, photo_path, created_at FROM users WHERE id=?').get(id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

function uploadPhoto(req, res, next) {
  try {
    const { id } = req.params;
    if (parseInt(id) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const photoPath = `uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET photo_path=?, updated_at=datetime(\'now\') WHERE id=?').run(photoPath, id);
    res.json({ photo_path: photoPath });
  } catch (err) {
    next(err);
  }
}

function getProfileStats(req, res, next) {
  try {
    const userId = req.user.id;

    // Training sessions completed
    const { sessions } = db.prepare(
      `SELECT COUNT(*) as sessions FROM training_checkins WHERE user_id=? AND status='completed'`
    ).get(userId);

    // Total reps + per-exercise breakdown from training tab
    const { total_reps } = db.prepare(
      `SELECT COALESCE(SUM(reps_done),0) as total_reps FROM training_exercise_logs WHERE user_id=?`
    ).get(userId);

    const exerciseBreakdown = db.prepare(`
      SELECT exercise_name, SUM(reps_done) as total_reps, COUNT(*) as sets
      FROM training_exercise_logs
      WHERE user_id=? AND reps_done IS NOT NULL
      GROUP BY exercise_name
      ORDER BY total_reps DESC
      LIMIT 10
    `).all(userId);

    // Workout logs stats (manual log tab)
    const logStats = db.prepare(`
      SELECT
        COUNT(*) as total_workouts,
        COALESCE(SUM(reps),0) as total_reps_logged,
        COALESCE(SUM(sets),0) as total_sets,
        COALESCE(SUM(duration_secs),0) as total_duration_secs
      FROM workout_logs WHERE user_id=?
    `).get(userId);

    // Active program info
    const attempt = db.prepare(
      `SELECT * FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`
    ).get(userId);

    let programDay = null;
    if (attempt) {
      const startDate = attempt.started_at.split(' ')[0];
      const today = new Date().toISOString().split('T')[0];
      const day = Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1;
      programDay = Math.min(Math.max(day, 1), 60);
    }

    const streak = getStreakForUser(userId);
    res.json({
      sessions,
      streak,
      total_reps: Number(total_reps),
      exercise_breakdown: exerciseBreakdown,
      log_stats: logStats,
      program_day: programDay,
    });
  } catch (err) { next(err); }
}

function getUniversalScores(req, res, next) {
  try {
    const userId = req.user.id;

    // Get program start date (for denominator)
    const attempt = db.prepare(
      `SELECT started_at FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`
    ).get(userId);
    const startDate = attempt ? attempt.started_at.split(' ')[0] : null;
    const today = new Date().toISOString().split('T')[0];
    const daysElapsed = startDate
      ? Math.max(1, Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1)
      : 1;

    // ── 1. On-Time Ratio ────────────────────────────────────────────────────
    // Wake: passed = on time, failed = not on time
    const wakeRows = db.prepare(`SELECT status FROM wake_presence WHERE user_id=? AND status != 'pending'`).all(userId);
    const wakeOnTime = wakeRows.filter(r => r.status === 'passed').length;
    const wakeTotal  = wakeRows.length;

    // Training: completed AND late_checkin=0 = on time; late_checkin=1 OR failed = late
    const trainRows = db.prepare(
      `SELECT status, late_checkin FROM training_checkins WHERE user_id=? AND status != 'pending'`
    ).all(userId);
    const trainOnTime = trainRows.filter(r => r.status === 'completed' && !r.late_checkin).length;
    const trainTotal  = trainRows.length;

    // Stretch: same logic
    const stretchRows = db.prepare(
      `SELECT status, late_checkin FROM stretch_checkins WHERE user_id=? AND status != 'pending'`
    ).all(userId);
    const stretchOnTime = stretchRows.filter(r => r.status === 'completed' && !r.late_checkin).length;
    const stretchTotal  = stretchRows.length;

    // Meditation: started within 30 min of scheduled meditate_time = on time
    const setup = db.prepare(`
      SELECT ps.meditate_time, ps.meditate_eve_time FROM program_setup ps
      JOIN program_attempts pa ON pa.id = ps.attempt_id
      WHERE pa.user_id=? AND pa.status='active' ORDER BY pa.id DESC LIMIT 1
    `).get(userId);
    const meditRows = db.prepare(`SELECT * FROM meditation_sessions WHERE user_id=? AND status='passed'`).all(userId);
    let meditOnTime = 0;
    const meditTotal = meditRows.length;
    if (setup?.meditate_time) {
      const [mh, mm] = setup.meditate_time.split(':').map(Number);
      meditRows.forEach(s => {
        const startedAt = new Date(s.started_at + 'Z');
        const scheduled = new Date(startedAt);
        scheduled.setHours(mh, mm, 0, 0);
        const diffMins = (startedAt - scheduled) / 60000;
        if (diffMins <= 30) meditOnTime++;
      });
    } else {
      meditOnTime = meditTotal; // if no schedule, count all as on-time
    }

    const onTimeDenom = wakeTotal + trainTotal + stretchTotal + meditTotal;
    const onTimeNum   = wakeOnTime + trainOnTime + stretchOnTime + meditOnTime;
    const onTimeScore = onTimeDenom > 0 ? Math.round((onTimeNum / onTimeDenom) * 100) : null;

    // ── 2. Workout Completion ───────────────────────────────────────────────
    const started   = trainRows.filter(r => r.status === 'completed' || r.status === 'active').length;
    const completed = trainRows.filter(r => r.status === 'completed').length;
    const workoutCompletion = started > 0 ? Math.round((completed / started) * 100) : null;

    // ── 3. Mental / Body Score ──────────────────────────────────────────────
    const meditPassed  = db.prepare(`SELECT COUNT(*) as c FROM meditation_sessions WHERE user_id=? AND status='passed'`).get(userId).c;
    const meditAllDone = db.prepare(`SELECT COUNT(*) as c FROM meditation_sessions WHERE user_id=? AND status!='pending'`).get(userId).c;
    const stretchComp  = db.prepare(`SELECT COUNT(*) as c FROM stretch_checkins WHERE user_id=? AND status='completed'`).get(userId).c;
    const stretchAll   = db.prepare(`SELECT COUNT(*) as c FROM stretch_checkins WHERE user_id=? AND status!='pending'`).get(userId).c;
    const mbDenom = meditAllDone + stretchAll;
    const mbNum   = meditPassed + stretchComp;
    const mentalBodyScore = mbDenom > 0 ? Math.round((mbNum / mbDenom) * 100) : null;

    // ── 4. Consistency Score ────────────────────────────────────────────────
    // Count any completed/passed/active action across all 4 activities per day
    const wakeActual    = db.prepare(`SELECT COUNT(*) as c FROM wake_presence WHERE user_id=? AND status='passed'`).get(userId).c;
    const trainActual   = db.prepare(`SELECT COUNT(*) as c FROM training_checkins WHERE user_id=? AND status='completed'`).get(userId).c;
    const stretchActual = db.prepare(`SELECT COUNT(*) as c FROM stretch_checkins WHERE user_id=? AND status='completed'`).get(userId).c;
    const meditActual   = db.prepare(`SELECT COUNT(*) as c FROM meditation_sessions WHERE user_id=? AND status='passed'`).get(userId).c;
    const totalDone     = wakeActual + trainActual + stretchActual + meditActual;
    const totalExpected = daysElapsed * 4;
    const consistencyScore = Math.round(Math.min((totalDone / totalExpected) * 100, 100));

    res.json({
      on_time:     onTimeScore,
      workout_completion: workoutCompletion,
      mental_body: mentalBodyScore,
      consistency: consistencyScore,
      meta: { days_elapsed: daysElapsed, total_done: totalDone, total_expected: totalExpected },
    });
  } catch (err) { next(err); }
}

function getWorkoutBreakdown(req, res, next) {
  try {
    const userId = req.user.id;
    const rows = db.prepare(`
      SELECT
        exercise_type_id,
        exercise_name,
        COUNT(*) as total_sets,
        COALESCE(SUM(reps_done),0) as total_reps,
        COALESCE(SUM(CASE WHEN date(logged_at)=date('now') THEN reps_done ELSE 0 END),0) as day_reps,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m',logged_at)=strftime('%Y-%m','now') THEN reps_done ELSE 0 END),0) as month_reps,
        COALESCE(SUM(CASE WHEN strftime('%Y',logged_at)=strftime('%Y','now') THEN reps_done ELSE 0 END),0) as year_reps,
        MAX(weight_kg) as max_weight,
        COALESCE(SUM(CASE WHEN date(logged_at)=date('now') THEN COALESCE(reps_done,0)*COALESCE(weight_kg,0) ELSE 0 END),0) as day_kg,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m',logged_at)=strftime('%Y-%m','now') THEN COALESCE(reps_done,0)*COALESCE(weight_kg,0) ELSE 0 END),0) as month_kg,
        COALESCE(SUM(COALESCE(reps_done,0)*COALESCE(weight_kg,0)),0) as year_kg
      FROM training_exercise_logs
      WHERE user_id=?
      GROUP BY exercise_type_id, exercise_name
      ORDER BY total_reps DESC
    `).all(userId);

    res.json({ exercises: rows });
  } catch (err) { next(err); }
}

// ── B1: Per-exercise progression chart ────────────────────────────────────────
function getExerciseProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const attempt = db.prepare(`SELECT * FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`).get(userId);
    if (!attempt) return res.json({ exercises: [], points: [] });

    const startDate = attempt.started_at.split(' ')[0];
    const rows = db.prepare(`
      SELECT et.name AS exercise_name, tel.exercise_type_id,
        CAST(julianday(tc.date) - julianday(?) + 1 AS INTEGER) AS program_day,
        MAX(tel.weight_kg) AS max_weight,
        MAX(tel.reps_done) AS max_reps,
        tc.date
      FROM training_exercise_logs tel
      JOIN training_checkins tc ON tc.id = tel.checkin_id
      JOIN exercise_types et ON et.id = tel.exercise_type_id
      WHERE tel.user_id=? AND tc.status='completed'
      GROUP BY tel.exercise_type_id, tc.date
      ORDER BY tel.exercise_type_id, tc.date ASC
    `).all(startDate, userId);

    // Group by exercise
    const exerciseMap = {};
    for (const r of rows) {
      if (!exerciseMap[r.exercise_type_id]) {
        exerciseMap[r.exercise_type_id] = { exercise_name: r.exercise_name, exercise_type_id: r.exercise_type_id, points: [] };
      }
      exerciseMap[r.exercise_type_id].points.push({ program_day: r.program_day, max_weight: r.max_weight, max_reps: r.max_reps, date: r.date });
    }
    res.json({ exercises: Object.values(exerciseMap) });
  } catch (err) { next(err); }
}

// ── B2: Volume load per muscle group ──────────────────────────────────────────
function getMuscleVolume(req, res, next) {
  try {
    const userId = req.user.id;
    const rows = db.prepare(`
      SELECT et.muscle_group,
        COALESCE(SUM(tel.reps_done), 0) AS total_reps,
        COALESCE(SUM(tel.reps_done * COALESCE(tel.weight_kg, 0)), 0) AS total_volume,
        COALESCE(SUM(CASE WHEN tc.date >= date('now', '-7 days') THEN tel.reps_done * COALESCE(tel.weight_kg, 0) ELSE 0 END), 0) AS week_volume,
        COALESCE(SUM(CASE WHEN tc.date >= date('now', '-7 days') THEN tel.reps_done ELSE 0 END), 0) AS week_reps
      FROM training_exercise_logs tel
      JOIN training_checkins tc ON tc.id = tel.checkin_id
      JOIN exercise_types et ON et.id = tel.exercise_type_id
      WHERE tel.user_id=?
      GROUP BY et.muscle_group
      ORDER BY week_volume DESC
    `).all(userId);
    res.json({ muscles: rows });
  } catch (err) { next(err); }
}

// ── B3: Daily discipline scores for calendar heatmap ─────────────────────────
function getDailyScores(req, res, next) {
  try {
    const userId = req.user.id;
    const { yearMonth } = req.params; // YYYY-MM
    const [year, month] = yearMonth.split('-');
    const monthStart = `${yearMonth}-01`;
    const monthEnd   = `${yearMonth}-31`;

    const wakeRows    = db.prepare(`SELECT date, status FROM wake_presence     WHERE user_id=? AND date BETWEEN ? AND ?`).all(userId, monthStart, monthEnd);
    const trainRows   = db.prepare(`SELECT date, status FROM training_checkins WHERE user_id=? AND date BETWEEN ? AND ?`).all(userId, monthStart, monthEnd);
    const stretchRows = db.prepare(`SELECT date, status FROM stretch_checkins  WHERE user_id=? AND date BETWEEN ? AND ?`).all(userId, monthStart, monthEnd);
    const meditRows   = db.prepare(`SELECT date, status FROM meditation_sessions WHERE user_id=? AND date BETWEEN ? AND ?`).all(userId, monthStart, monthEnd);
    const prRows      = db.prepare(`SELECT date(achieved_at) as date FROM personal_records WHERE user_id=? AND date(achieved_at) BETWEEN ? AND ?`).all(userId, monthStart, monthEnd);

    const prDates = new Set(prRows.map(r => r.date));

    const byDate = {};
    const addActivity = (rows, passedStatus) => {
      for (const r of rows) {
        if (!byDate[r.date]) byDate[r.date] = { done: 0, total: 0 };
        if (r.status !== 'pending') {
          byDate[r.date].total++;
          if (r.status === passedStatus || r.status === 'completed') byDate[r.date].done++;
        }
      }
    };
    addActivity(wakeRows,    'passed');
    addActivity(trainRows,   'completed');
    addActivity(stretchRows, 'completed');
    addActivity(meditRows,   'passed');

    const scores = {};
    for (const [date, { done, total }] of Object.entries(byDate)) {
      scores[date] = { score: total > 0 ? done / total : 0, pr: prDates.has(date) };
    }
    res.json({ scores });
  } catch (err) { next(err); }
}

// ── B4: Monthly aggregate report ─────────────────────────────────────────────
function getMonthlyReport(req, res, next) {
  try {
    const userId = req.user.id;
    const yearMonth = req.query.yearMonth || new Date().toISOString().slice(0, 7);
    const monthStart = `${yearMonth}-01`;
    const monthEnd   = `${yearMonth}-31`;

    const { sessions } = db.prepare(`SELECT COUNT(*) as sessions FROM training_checkins WHERE user_id=? AND status='completed' AND date BETWEEN ? AND ?`).get(userId, monthStart, monthEnd);
    const { total_volume } = db.prepare(`
      SELECT COALESCE(SUM(tel.reps_done * COALESCE(tel.weight_kg, 0)), 0) AS total_volume
      FROM training_exercise_logs tel
      JOIN training_checkins tc ON tc.id = tel.checkin_id
      WHERE tel.user_id=? AND tc.date BETWEEN ? AND ?
    `).get(userId, monthStart, monthEnd);
    const { new_prs } = db.prepare(`SELECT COUNT(*) as new_prs FROM personal_records WHERE user_id=? AND date(achieved_at) BETWEEN ? AND ?`).get(userId, monthStart, monthEnd);

    // Longest streak within month
    const allDays = db.prepare(`
      SELECT date FROM training_checkins WHERE user_id=? AND status='completed' AND date BETWEEN ? AND ? ORDER BY date ASC
    `).all(userId, monthStart, monthEnd).map(r => r.date);
    let longest = 0, cur = 0, prev = null;
    for (const d of allDays) {
      if (prev) {
        const diff = (new Date(d) - new Date(prev)) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      } else { cur = 1; }
      longest = Math.max(longest, cur);
      prev = d;
    }

    // Monthly weight check-in
    const [y, m] = yearMonth.split('-');
    const weightRow = db.prepare(`SELECT weight_kg FROM monthly_checkins WHERE user_id=? AND year=? AND month=?`).get(userId, parseInt(y), parseInt(m));
    const prevMonth = m === '01' ? `${parseInt(y)-1}-12` : `${y}-${String(parseInt(m)-1).padStart(2,'0')}`;
    const [py, pm] = prevMonth.split('-');
    const prevWeightRow = db.prepare(`SELECT weight_kg FROM monthly_checkins WHERE user_id=? AND year=? AND month=?`).get(userId, parseInt(py), parseInt(pm));
    const weight_change = (weightRow?.weight_kg && prevWeightRow?.weight_kg)
      ? Math.round((weightRow.weight_kg - prevWeightRow.weight_kg) * 10) / 10 : null;

    res.json({ sessions, total_volume_kg: Math.round(total_volume), new_prs, longest_streak: longest, weight_change, year_month: yearMonth });
  } catch (err) { next(err); }
}

// ── C1: Streak reflection ─────────────────────────────────────────────────────
function saveStreakReflection(req, res, next) {
  try {
    const userId = req.user.id;
    const { date, reflection } = req.body;
    if (!date || !reflection) return res.status(400).json({ error: 'date and reflection required' });

    // Max 1 reflection per 7 days
    const recent = db.prepare(`SELECT * FROM streak_reflections WHERE user_id=? AND date >= date('now', '-7 days')`).get(userId);
    if (recent) return res.status(429).json({ error: 'You can only use resilience mode once per 7 days' });

    db.prepare(`INSERT INTO streak_reflections (user_id, date, reflection) VALUES (?,?,?)`).run(userId, date, reflection);
    res.json({ streak_preserved: true });
  } catch (err) { next(err); }
}

// ── C2: Badges ────────────────────────────────────────────────────────────────
const BADGES = [
  { key: 'week_1',    day: 7,  label: 'First Week Warrior', icon: '🔥' },
  { key: 'week_2',    day: 14, label: 'Two Weeks Strong',   icon: '💪' },
  { key: 'day_30',    day: 30, label: 'Halfway',            icon: '⚡' },
  { key: 'day_45',    day: 45, label: 'The Grind',          icon: '🦾' },
  { key: 'day_60',    day: 60, label: 'Program Complete',   icon: '🏆' },
];

function checkAndAwardBadges(userId) {
  const attempt = db.prepare(`SELECT started_at FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`).get(userId);
  if (!attempt) return [];
  const startDate = attempt.started_at.split(' ')[0];
  const today = new Date().toISOString().split('T')[0];
  const programDay = Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1;
  const newBadges = [];
  for (const badge of BADGES) {
    if (programDay >= badge.day) {
      try {
        db.prepare(`INSERT OR IGNORE INTO user_badges (user_id, badge_key) VALUES (?,?)`).run(userId, badge.key);
        // Check if it was just inserted (not previously existing)
      } catch {}
    }
  }
  return newBadges;
}

function getBadges(req, res, next) {
  try {
    const userId = req.user.id;
    checkAndAwardBadges(userId);
    const earned = db.prepare(`SELECT badge_key, earned_at FROM user_badges WHERE user_id=?`).all(userId);
    const earnedMap = Object.fromEntries(earned.map(b => [b.badge_key, b.earned_at]));
    const badges = BADGES.map(b => ({
      ...b,
      earned: !!earnedMap[b.key],
      earned_at: earnedMap[b.key] || null,
    }));
    res.json({ badges });
  } catch (err) { next(err); }
}

// ── C3: Extend getUniversalScores with weekly trend ───────────────────────────
function getUniversalScoresWithTrend(req, res, next) {
  try {
    const userId = req.user.id;

    function calcScores(fromDate, toDate) {
      const wakeRows    = db.prepare(`SELECT status FROM wake_presence     WHERE user_id=? AND date BETWEEN ? AND ? AND status != 'pending'`).all(userId, fromDate, toDate);
      const trainRows   = db.prepare(`SELECT status, late_checkin FROM training_checkins WHERE user_id=? AND date BETWEEN ? AND ? AND status != 'pending'`).all(userId, fromDate, toDate);
      const stretchRows = db.prepare(`SELECT status FROM stretch_checkins  WHERE user_id=? AND date BETWEEN ? AND ? AND status != 'pending'`).all(userId, fromDate, toDate);
      const meditRows   = db.prepare(`SELECT * FROM meditation_sessions    WHERE user_id=? AND date BETWEEN ? AND ? AND status='passed'`).all(userId, fromDate, toDate);

      const wakeOnTime = wakeRows.filter(r => r.status === 'passed').length;
      const trainOnTime = trainRows.filter(r => r.status === 'completed' && !r.late_checkin).length;
      const stretchOnTime = stretchRows.filter(r => r.status === 'completed').length;
      const onTimeDenom = wakeRows.length + trainRows.length + stretchRows.length + meditRows.length;
      const onTimeNum   = wakeOnTime + trainOnTime + stretchOnTime + meditRows.length;
      const onTime = onTimeDenom > 0 ? Math.round((onTimeNum / onTimeDenom) * 100) : null;

      const started   = trainRows.filter(r => r.status === 'completed' || r.status === 'active').length;
      const completed = trainRows.filter(r => r.status === 'completed').length;
      const workoutCompletion = started > 0 ? Math.round((completed / started) * 100) : null;

      const meditPassed  = db.prepare(`SELECT COUNT(*) as c FROM meditation_sessions WHERE user_id=? AND status='passed' AND date BETWEEN ? AND ?`).get(userId, fromDate, toDate).c;
      const meditAll     = db.prepare(`SELECT COUNT(*) as c FROM meditation_sessions WHERE user_id=? AND status!='pending' AND date BETWEEN ? AND ?`).get(userId, fromDate, toDate).c;
      const stretchComp  = db.prepare(`SELECT COUNT(*) as c FROM stretch_checkins WHERE user_id=? AND status='completed' AND date BETWEEN ? AND ?`).get(userId, fromDate, toDate).c;
      const stretchAll   = db.prepare(`SELECT COUNT(*) as c FROM stretch_checkins WHERE user_id=? AND status!='pending' AND date BETWEEN ? AND ?`).get(userId, fromDate, toDate).c;
      const mbDenom = meditAll + stretchAll;
      const mentalBody = mbDenom > 0 ? Math.round(((meditPassed + stretchComp) / mbDenom) * 100) : null;

      return { onTime, workoutCompletion, mentalBody };
    }

    const todayStr    = new Date().toISOString().split('T')[0];
    const weekAgo     = new Date(Date.now() - 7  * 86400000).toISOString().split('T')[0];
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    const thisWeek = calcScores(weekAgo, todayStr);
    const prevWeek = calcScores(twoWeeksAgo, weekAgo);

    function trend(cur, prev) {
      if (cur == null || prev == null) return null;
      const diff = cur - prev;
      return diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';
    }

    // Also compute full-history scores (same as before) for overall numbers
    const attempt = db.prepare(`SELECT started_at FROM program_attempts WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1`).get(userId);
    const startDate = attempt ? attempt.started_at.split(' ')[0] : null;
    const daysElapsed = startDate ? Math.max(1, Math.floor((new Date(todayStr) - new Date(startDate)) / 86400000) + 1) : 1;

    const wakeActual    = db.prepare(`SELECT COUNT(*) as c FROM wake_presence WHERE user_id=? AND status='passed'`).get(userId).c;
    const trainActual   = db.prepare(`SELECT COUNT(*) as c FROM training_checkins WHERE user_id=? AND status='completed'`).get(userId).c;
    const stretchActual = db.prepare(`SELECT COUNT(*) as c FROM stretch_checkins WHERE user_id=? AND status='completed'`).get(userId).c;
    const meditActual   = db.prepare(`SELECT COUNT(*) as c FROM meditation_sessions WHERE user_id=? AND status='passed'`).get(userId).c;
    const totalDone     = wakeActual + trainActual + stretchActual + meditActual;
    const consistencyScore = Math.round(Math.min((totalDone / (daysElapsed * 4)) * 100, 100));

    const allScores = calcScores('2000-01-01', todayStr);
    const prevAllScores = calcScores('2000-01-01', weekAgo);

    res.json({
      on_time:            { score: allScores.onTime,            prev: prevAllScores.onTime,            trend: trend(allScores.onTime,            prevAllScores.onTime)            },
      workout_completion: { score: allScores.workoutCompletion, prev: prevAllScores.workoutCompletion, trend: trend(allScores.workoutCompletion, prevAllScores.workoutCompletion) },
      mental_body:        { score: allScores.mentalBody,        prev: prevAllScores.mentalBody,        trend: trend(allScores.mentalBody,        prevAllScores.mentalBody)        },
      consistency:        { score: consistencyScore,            prev: null,                            trend: null                                                                },
      meta: { days_elapsed: daysElapsed },
    });
  } catch (err) { next(err); }
}

// ── Reps stats: per-exercise aggregates from training_exercise_logs ──────────
function getRepsStats(req, res, next) {
  try {
    const userId = req.user.id;

    const allTime = db.prepare(`
      SELECT exercise_name as name,
             SUM(reps_done) as total_reps,
             COUNT(*) as total_sets,
             MAX(weight_kg) as max_weight
      FROM training_exercise_logs
      WHERE user_id=? AND reps_done IS NOT NULL
      GROUP BY exercise_name
    `).all(userId);

    const bestDay = db.prepare(`
      SELECT exercise_name as name, MAX(day_reps) as best_day FROM (
        SELECT exercise_name, date(logged_at) as d, SUM(reps_done) as day_reps
        FROM training_exercise_logs WHERE user_id=? AND reps_done IS NOT NULL
        GROUP BY exercise_name, d
      ) GROUP BY exercise_name
    `).all(userId);

    const bestMonth = db.prepare(`
      SELECT exercise_name as name, MAX(month_reps) as best_month FROM (
        SELECT exercise_name, strftime('%Y-%m', logged_at) as m, SUM(reps_done) as month_reps
        FROM training_exercise_logs WHERE user_id=? AND reps_done IS NOT NULL
        GROUP BY exercise_name, m
      ) GROUP BY exercise_name
    `).all(userId);

    const bestYear = db.prepare(`
      SELECT exercise_name as name, MAX(year_reps) as best_year FROM (
        SELECT exercise_name, strftime('%Y', logged_at) as y, SUM(reps_done) as year_reps
        FROM training_exercise_logs WHERE user_id=? AND reps_done IS NOT NULL
        GROUP BY exercise_name, y
      ) GROUP BY exercise_name
    `).all(userId);

    const map = {};
    for (const r of allTime) {
      map[r.name] = { name: r.name, total_reps: r.total_reps, total_sets: r.total_sets, max_weight: r.max_weight, best_day: 0, best_month: 0, best_year: 0 };
    }
    for (const r of bestDay)   if (map[r.name]) map[r.name].best_day   = r.best_day;
    for (const r of bestMonth) if (map[r.name]) map[r.name].best_month = r.best_month;
    for (const r of bestYear)  if (map[r.name]) map[r.name].best_year  = r.best_year;

    res.json(Object.values(map).sort((a, b) => b.total_reps - a.total_reps));
  } catch (err) { next(err); }
}

// ── Running stats: aggregated from workout_logs (cardio), band sessions, running_progress ──
function getRunningStats(req, res, next) {
  try {
    const userId = req.user.id;

    const logRuns = db.prepare(`
      SELECT wl.distance_km, wl.duration_secs, wl.logged_at
      FROM workout_logs wl
      JOIN exercise_types et ON et.id = wl.exercise_type_id
      WHERE wl.user_id=? AND et.category='cardio' AND wl.distance_km IS NOT NULL AND wl.distance_km > 0
      ORDER BY wl.logged_at DESC
    `).all(userId);

    const bandRuns = db.prepare(`
      SELECT distance_km, duration_secs, started_at as logged_at
      FROM band_workout_sessions
      WHERE user_id=? AND distance_km IS NOT NULL AND distance_km > 0
      ORDER BY started_at DESC
    `).all(userId);

    const progRuns = db.prepare(`
      SELECT actual_distance_km as distance_km, NULL as duration_secs, completed_at as logged_at
      FROM running_progress
      WHERE user_id=? AND actual_distance_km IS NOT NULL AND actual_distance_km > 0
      ORDER BY completed_at DESC
    `).all(userId);

    const allRuns = [...logRuns, ...bandRuns, ...progRuns];
    const totalDistance = allRuns.reduce((s, r) => s + (r.distance_km || 0), 0);
    const totalDuration = allRuns.reduce((s, r) => s + (r.duration_secs || 0), 0);
    const bestRun = allRuns.reduce((best, r) => Math.max(best, r.distance_km || 0), 0);
    const avgPace = totalDuration && totalDistance ? (totalDuration / 60) / totalDistance : null;

    const monthly = db.prepare(`
      SELECT strftime('%Y-%m', wl.logged_at) as month,
             COUNT(*) as runs,
             ROUND(SUM(wl.distance_km), 2) as distance,
             SUM(wl.duration_secs) as duration
      FROM workout_logs wl
      JOIN exercise_types et ON et.id = wl.exercise_type_id
      WHERE wl.user_id=? AND et.category='cardio' AND wl.distance_km > 0
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).all(userId);

    res.json({
      total_runs: allRuns.length,
      total_distance_km: Math.round(totalDistance * 100) / 100,
      total_duration_secs: totalDuration,
      best_run_km: bestRun,
      avg_pace_min_per_km: avgPace ? Math.round(avgPace * 100) / 100 : null,
      recent_runs: allRuns.slice(0, 20),
      monthly_breakdown: monthly,
    });
  } catch (err) { next(err); }
}

// ── D1: Leaderboard with streak check (helper exported for leaderboard controller)
function getStreakForUser(userId) {
  const reflections = db.prepare(`SELECT date FROM streak_reflections WHERE user_id=?`).all(userId).map(r => r.date);
  const reflSet = new Set(reflections);
  const all = db.prepare(`SELECT date, status FROM training_checkins WHERE user_id=? ORDER BY date DESC`).all(userId);
  let streak = 0;
  for (const r of all) {
    if (r.status === 'pending') continue;
    if (r.status === 'completed' || reflSet.has(r.date)) streak++;
    else break;
  }
  return streak;
}

module.exports = {
  updateUser, uploadPhoto, getProfileStats, getUniversalScores, getWorkoutBreakdown,
  getExerciseProgress, getMuscleVolume, getDailyScores, getMonthlyReport,
  saveStreakReflection, getBadges, checkAndAwardBadges,
  getUniversalScoresWithTrend, getStreakForUser,
  getRepsStats, getRunningStats,
};
