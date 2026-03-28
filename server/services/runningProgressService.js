'use strict';
const db = require('../db/database');

// Starting distance and growth rate
const START_KM         = 3.0;
const GROWTH_RATE      = 1.10;  // +10% per run
const RECOVERY_RUN_MIN = 30;    // Sunday recovery run duration

// Week position: 1=Mon(S), 2=Tue(R), 3=Wed(S), 4=Thu(R), 5=Fri(S), 6=Sat(R), 7=Sun(RR)
function getDayType(day) {
  const pos = ((day - 1) % 7) + 1;
  if (pos === 7) return 'recovery_run';
  if (pos % 2 === 0) return 'running';
  return 'strength';
}

function isSundayRun(currentDay) {
  return getDayType(currentDay) === 'recovery_run';
}

// Round to 1 decimal
function roundKm(km) {
  return Math.round(km * 10) / 10;
}

// Get or initialise the running progression for this user+attempt
// Returns { run_number, target_distance_km, is_recovery_run, completed_today }
function getRunPlan(userId, attemptId, currentDay, dateStr) {
  // Count how many running days have occurred up to (but not including) today
  // Running days = even days (2, 4, 6, ...) in the 60-day program
  // Odd days are strength, even days are running

  // Figure out which run number today is
  // Runs: day 2=run1, day 4=run2, day 6=run3, day 7=recoveryRun1,
  //       day 8=run4, day 10=run5, ...
  // Actually with the weekly structure:
  //   Mon/Tue/Thu/Sat = strength (days 1,3,5 within week pattern)
  //   Tue/Thu/Sat = running (days 2,4,6 within week pattern)
  //   Sun = recovery run (day 7 within week pattern)
  // With currentDay from 1-60, even days = run, day%7===0 = recovery run

  const isRecovery = isSundayRun(currentDay);

  // How many progressive runs have been completed before today?
  // Count rows with completed_at not null and is_recovery_run=0 and run_number < today's run_number
  // First, determine today's run_number among all running days
  // Progressive run days = even days that are NOT multiples of 7
  // Recovery days = multiples of 7

  // Calculate today's run sequence number
  let progressiveRunsBefore = 0;
  let recoveryRunsBefore = 0;
  for (let d = 1; d < currentDay; d++) {
    const t = getDayType(d);
    if (t === 'recovery_run') recoveryRunsBefore++;
    else if (t === 'running') progressiveRunsBefore++;
  }

  // Check if today's run is already logged
  const todayRun = db.prepare(
    'SELECT * FROM running_progress WHERE user_id=? AND attempt_id=? AND completed_at IS NOT NULL AND date(completed_at)=?'
  ).get(userId, attemptId, dateStr);

  if (isRecovery) {
    const runNum = recoveryRunsBefore + 1;
    return {
      run_number:         runNum,
      is_recovery_run:    true,
      target_distance_km: null,
      target_duration_min: RECOVERY_RUN_MIN,
      completed_today:    !!todayRun,
      actual_distance_km: todayRun ? todayRun.actual_distance_km : null,
    };
  }

  // Progressive run
  const runNum = progressiveRunsBefore + 1;
  // Calculate target: START_KM × GROWTH_RATE^(runNum-1)
  const targetKm = roundKm(START_KM * Math.pow(GROWTH_RATE, runNum - 1));

  return {
    run_number:          runNum,
    is_recovery_run:     false,
    target_distance_km:  targetKm,
    target_duration_min: null,
    completed_today:     !!todayRun,
    actual_distance_km:  todayRun ? todayRun.actual_distance_km : null,
  };
}

// Log a completed run
// actualDistanceKm is optional (user may not track it)
function completeRun(userId, attemptId, currentDay, dateStr, actualDistanceKm) {
  const isRecovery = isSundayRun(currentDay);

  let progressiveRunsBefore = 0;
  let recoveryRunsBefore = 0;
  for (let d = 1; d < currentDay; d++) {
    const t = getDayType(d);
    if (t === 'recovery_run') recoveryRunsBefore++;
    else if (t === 'running') progressiveRunsBefore++;
  }

  const runNum   = isRecovery ? (recoveryRunsBefore + 1) : (progressiveRunsBefore + 1);
  const targetKm = isRecovery ? null : roundKm(START_KM * Math.pow(GROWTH_RATE, runNum - 1));

  db.prepare(`
    INSERT INTO running_progress (user_id, attempt_id, run_number, target_distance_km, is_recovery_run, completed_at, actual_distance_km)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, attempt_id, run_number) DO UPDATE SET
      completed_at       = excluded.completed_at,
      actual_distance_km = excluded.actual_distance_km
  `).run(userId, attemptId, runNum, targetKm, isRecovery ? 1 : 0, dateStr + 'T' + new Date().toTimeString().slice(0, 8), actualDistanceKm || null);

  return { run_number: runNum, target_distance_km: targetKm, actual_distance_km: actualDistanceKm || null };
}

module.exports = { getRunPlan, completeRun, isSundayRun };
