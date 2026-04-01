'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import Card from '../../../design-system/Card.jsx';
import Badge from '../../../design-system/Badge.jsx';
import { getScheduleDay, coldPlungeDone, showerComplete, workStart, homeArrive } from '../../../api/scheduleApi.js';
import { getTodayPresence, clockInPresence } from '../../../api/wakePresenceApi.js';
import { getTodayTraining, checkinTraining, logExercise, completeTraining, logRun } from '../../../api/trainingCheckinApi.js';
import { getTodayStretch, checkinStretch, completeStretch } from '../../../api/stretchCheckinApi.js';
import { getProgramStatus } from '../../../api/programApi.js';

/* ─── helpers ─────────────────────────────────────── */
function nowSecs() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}
function hhmmToSecs(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 3600 + m * 60;
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function taskScheduledTime(key, sched) {
  const s = sched?.schedule;
  switch (key) {
    case 'wake':     return s?.wake_time;
    case 'plunge':   return s?.cold_plunge_time;
    case 'training': return s?.train_time;
    case 'shower':   return s?.shower_time;
    case 'leave':    return sched?.leave_time;
    case 'home':     return sched?.return_time;
    case 'stretch':  return s?.stretch_time;
    default:         return null;
  }
}
const TASK_META = {
  wake:     { icon: '⏰', label: 'Wake',           btn: 'Clock In'    },
  plunge:   { icon: '🧊', label: 'Cold Plunge',    btn: 'Done ✓'      },
  training: { icon: '💪', label: 'Training',       btn: 'Check In'    },
  shower:   { icon: '🚿', label: 'Shower',         btn: 'Done ✓'      },
  leave:    { icon: '🚶', label: 'Leave for Work', btn: 'Leaving Now' },
  home:     { icon: '🏠', label: 'Home',           btn: "I'm Home"    },
  stretch:  { icon: '🤸', label: 'Stretch',        btn: 'Start'       },
};

/* ─── ExerciseRow ─────────────────────────────────── */
function ExerciseRow({ ex, logged, logState, onChange, onLog }) {
  return (
    <div className={`rounded-xl p-3 ${logged ? 'bg-emerald-900/20 border border-emerald-800/30' : 'bg-[var(--card-2)]'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{ex.name}</p>
          <p className="text-xs text-[var(--text-3)]">{ex.sets}×{ex.reps} · {ex.muscle_group}</p>
          {ex.last_session && (
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Last: {ex.last_session.reps_done}r × {ex.last_session.weight_kg}kg
            </p>
          )}
        </div>
        {logged && <span className="text-emerald-400 text-lg">✓</span>}
      </div>
      {!logged && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number" inputMode="numeric" placeholder="Reps"
            className="w-[72px] px-2 py-1.5 rounded-lg text-sm bg-[var(--card)] border border-[var(--border)] text-white"
            value={logState?.reps || ''}
            onChange={e => onChange(ex.id, 'reps', e.target.value)}
          />
          <input
            type="number" inputMode="decimal" placeholder="kg"
            className="w-[72px] px-2 py-1.5 rounded-lg text-sm bg-[var(--card)] border border-[var(--border)] text-white"
            value={logState?.weight || ''}
            onChange={e => onChange(ex.id, 'weight', e.target.value)}
          />
          <button
            onClick={() => onLog(ex)}
            disabled={logState?.saving}
            className="flex-1 py-1.5 rounded-lg text-sm font-bold bg-[var(--accent)] text-white disabled:opacity-50"
          >
            {logState?.saving ? '…' : 'Log'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── RunExpanded ─────────────────────────────────── */
function RunExpanded({ training, onReload }) {
  const [actualDist, setActualDist] = useState('');
  const [logging, setLogging] = useState(false);
  const plan = training?.plan;
  const isRecovery = plan?.day_type === 'recovery_run';
  const targetLabel = isRecovery
    ? `${plan.target_duration_min ?? 15} min easy run`
    : `${plan.target_distance_km} km`;

  async function onLogRun() {
    setLogging(true);
    try {
      await logRun({
        attempt_id: plan.attempt_id,
        current_day: plan.current_day,
        actual_distance_km: actualDist ? parseFloat(actualDist) : null,
      });
      await onReload();
    } catch (e) { console.error(e); }
    setLogging(false);
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl p-4 bg-[var(--card-2)] text-center">
        <p className="text-3xl font-black text-white">{targetLabel}</p>
        <p className="text-xs text-[var(--text-3)] mt-1">
          {isRecovery ? 'Recovery / Easy run' : `Run #${plan.run_number} · Phase ${plan.phase_number}`}
        </p>
      </div>
      {!isRecovery && (
        <input
          type="number" inputMode="decimal"
          placeholder={`Actual km (target: ${plan.target_distance_km})`}
          className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--card)] border border-[var(--border)] text-white"
          value={actualDist}
          onChange={e => setActualDist(e.target.value)}
        />
      )}
      <button
        onClick={onLogRun}
        disabled={logging}
        className="w-full py-3 rounded-xl font-bold text-sm bg-blue-600 text-white disabled:opacity-50"
      >
        {logging ? '…' : 'Log Run ✓'}
      </button>
    </div>
  );
}

/* ─── TrainingExpanded ────────────────────────────── */
function TrainingExpanded({ training, onReload }) {
  const [states, setStates] = useState({});
  const [completing, setCompleting] = useState(false);
  const plan = training?.plan;

  // Run days — delegate to RunExpanded
  if (plan?.day_type === 'run' || plan?.day_type === 'recovery_run') {
    return <RunExpanded training={training} onReload={onReload} />;
  }

  const exercises = plan?.exercises || [];
  const loggedIds = new Set((training?.exercise_logs || []).map(l => l.exercise_type_id));

  function onChange(id, field, val) {
    setStates(p => ({ ...p, [id]: { ...p[id], [field]: val } }));
  }

  async function onLog(ex) {
    const s = states[ex.id] || {};
    const fd = new FormData();
    fd.append('exercise_type_id', ex.id);
    fd.append('exercise_name', ex.name);
    if (s.reps)   fd.append('reps_done', s.reps);
    if (s.weight) fd.append('weight_kg', s.weight);
    setStates(p => ({ ...p, [ex.id]: { ...p[ex.id], saving: true } }));
    try { await logExercise(fd); await onReload(); }
    catch (e) { console.error(e); }
    setStates(p => ({ ...p, [ex.id]: { ...p[ex.id], saving: false } }));
  }

  async function onComplete() {
    setCompleting(true);
    try { await completeTraining(); await onReload(); }
    catch (e) { console.error(e); }
    setCompleting(false);
  }

  return (
    <div className="mt-3 space-y-2">
      {exercises.length === 0 && (
        <p className="text-xs text-[var(--text-3)] text-center py-2">No exercises planned for today</p>
      )}
      {exercises.map(ex => (
        <ExerciseRow
          key={ex.id} ex={ex}
          logged={loggedIds.has(ex.id)}
          logState={states[ex.id]}
          onChange={onChange}
          onLog={onLog}
        />
      ))}
      <button
        onClick={onComplete}
        disabled={completing}
        className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-600 text-white disabled:opacity-50"
      >
        {completing ? 'Completing…' : 'Complete Training ✓'}
      </button>
    </div>
  );
}

/* ─── CurrentCard ─────────────────────────────────── */
function CurrentCard({ taskKey, sched, training, stretch, onAction, onReload }) {
  const [busy, setBusy]       = useState(false);
  const [showEx, setShowEx]   = useState(true);
  const meta = TASK_META[taskKey];
  const scheduledTime = taskScheduledTime(taskKey, sched);
  const late = !!scheduledTime && nowSecs() > hhmmToSecs(scheduledTime);

  async function act(key) {
    setBusy(true);
    try { await onAction(key); }
    catch (e) { console.error(e); }
    setBusy(false);
  }

  /* Training — special expand */
  if (taskKey === 'training') {
    const startsOn = training?.starts_on;
    const status = training?.checkin?.status;
    const isActive = status === 'active';
    const lateCheckin = !!training?.checkin?.late_checkin;
    const isRunDay = training?.plan?.day_type === 'run' || training?.plan?.day_type === 'recovery_run';

    // Pre-start preview — program hasn't started yet
    if (startsOn) {
      return (
        <Card className="py-5 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{meta.icon}</span>
              <div>
                <h2 className="text-xl font-black text-white">{meta.label}</h2>
                <p className="text-xs text-emerald-400">Starts {fmtDate(startsOn)}</p>
              </div>
            </div>
          </div>
          {training?.plan && (
            <div className="mt-3 p-3 rounded-xl bg-[var(--card-2)]">
              <p className="text-xs text-[var(--text-3)] mb-2 uppercase tracking-wide">Day 1 Preview</p>
              {isRunDay ? (
                <p className="text-sm text-white">{training.plan.target_distance_km} km run</p>
              ) : (
                (training.plan.exercises || []).map(ex => (
                  <p key={ex.id} className="text-sm text-[var(--text-2)] py-0.5">• {ex.name}</p>
                ))
              )}
            </div>
          )}
        </Card>
      );
    }

    // Run day — skip check-in, go straight to RunExpanded
    if (isRunDay && !isActive) {
      return (
        <Card className="py-5 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏃</span>
              <div>
                <h2 className="text-xl font-black text-white">Run</h2>
                {scheduledTime && <p className="text-xs text-[var(--text-3)]">{fmtTime(scheduledTime)}</p>}
              </div>
            </div>
            {late && <Badge variant="warning">LATE</Badge>}
          </div>
          <RunExpanded training={training} onReload={onReload} />
        </Card>
      );
    }

    return (
      <Card className="py-5 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h2 className="text-xl font-black text-white">{meta.label}</h2>
              {scheduledTime && <p className="text-xs text-[var(--text-3)]">{fmtTime(scheduledTime)}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {(late || lateCheckin) && <Badge variant="warning">LATE</Badge>}
          </div>
        </div>
        {!isActive ? (
          <button onClick={() => act('training')} disabled={busy}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm bg-[var(--accent)] text-white disabled:opacity-50">
            {busy ? '…' : 'Check In'}
          </button>
        ) : (
          <>
            <button onClick={() => setShowEx(e => !e)}
              className="mt-3 w-full py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-2)]">
              {showEx ? 'Hide Exercises ▲' : 'Show Exercises ▼'}
            </button>
            {showEx && <TrainingExpanded training={training} onReload={onReload} />}
          </>
        )}
      </Card>
    );
  }

  /* Stretch — two step */
  if (taskKey === 'stretch') {
    const status = stretch?.checkin?.status;
    const isActive = status === 'active';
    return (
      <Card className="py-5 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h2 className="text-xl font-black text-white">{meta.label}</h2>
              {scheduledTime && <p className="text-xs text-[var(--text-3)]">{fmtTime(scheduledTime)}</p>}
            </div>
          </div>
          {late && !isActive && <Badge variant="warning">LATE</Badge>}
        </div>
        <button onClick={() => act('stretch')} disabled={busy}
          className="mt-4 w-full py-3 rounded-xl font-bold text-sm bg-[var(--accent)] text-white disabled:opacity-50">
          {busy ? '…' : isActive ? 'Complete Stretch ✓' : 'Start Stretch'}
        </button>
      </Card>
    );
  }

  /* Default one-tap */
  return (
    <Card className="py-5 px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h2 className="text-xl font-black text-white">{meta.label}</h2>
            {scheduledTime && <p className="text-xs text-[var(--text-3)]">{fmtTime(scheduledTime)}</p>}
          </div>
        </div>
        {late && <Badge variant="warning">LATE</Badge>}
      </div>
      <button onClick={() => act(taskKey)} disabled={busy}
        className="mt-4 w-full py-3 rounded-xl font-bold text-sm bg-[var(--accent)] text-white disabled:opacity-50">
        {busy ? '…' : meta.btn}
      </button>
    </Card>
  );
}

/* ─── Main page ───────────────────────────────────── */
export default function SchedulePage() {
  const { user } = useAuth();
  const [presence, setPresence]   = useState(null);
  const [training, setTraining]   = useState(null);
  const [stretch,  setStretch]    = useState(null);
  const [sched,    setSched]      = useState(null);
  const [program,  setProgram]    = useState(null);
  const [loading,  setLoading]    = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const reload = useCallback(async () => {
    const [sc, pr, tr, st, ps] = await Promise.allSettled([
      getScheduleDay(today),
      getTodayPresence(),
      getTodayTraining(),
      getTodayStretch(),
      getProgramStatus(),
    ]);
    if (sc.status === 'fulfilled') setSched(sc.value.data);
    if (pr.status === 'fulfilled') setPresence(pr.value.data);
    if (tr.status === 'fulfilled') setTraining(tr.value.data);
    if (st.status === 'fulfilled') setStretch(st.value.data);
    if (ps.status === 'fulfilled') setProgram(ps.value.data);
    setLoading(false);
  }, [today]);

  useEffect(() => { reload(); }, [reload]);

  /* Build tasks list */
  const hasWork = !!(sched?.leave_time);
  const tasks = [
    { key: 'wake',     done: !!presence?.record?.clocked_in_at,
                       late: !!presence?.record?.late_wakeup },
    { key: 'plunge',   done: !!sched?.cold_plunge_done_at },
    { key: 'training', done: training?.checkin?.status === 'completed' ||
                             training?.checkin?.status === 'passed',
                       late: !!training?.checkin?.late_checkin },
    { key: 'shower',   done: !!sched?.shower?.completed_at },
    { key: 'leave',    done: !!sched?.work?.started_at,  showIf: hasWork },
    { key: 'home',     done: !!sched?.home?.arrived_at,  showIf: hasWork },
    { key: 'stretch',  done: stretch?.checkin?.status === 'completed' ||
                             stretch?.checkin?.status === 'passed' },
  ].filter(t => t.showIf !== false);

  const completed  = tasks.filter(t => t.done);
  const remaining  = tasks.filter(t => !t.done);
  const currentKey = remaining[0]?.key ?? null;
  const upcoming   = remaining.slice(1);
  const allDone    = tasks.length > 0 && remaining.length === 0;

  async function handleAction(key) {
    switch (key) {
      case 'wake':     await clockInPresence();  break;
      case 'plunge':   await coldPlungeDone();   break;
      case 'training': await checkinTraining();  break;
      case 'shower':   await showerComplete();   break;
      case 'leave':    await workStart();        break;
      case 'home':     await homeArrive();       break;
      case 'stretch': {
        const st = stretch?.checkin?.status;
        if (st === 'active') { await completeStretch(); }
        else                 { await checkinStretch();  }
        break;
      }
    }
    await reload();
  }

  /* Date header — show program start date if not started yet */
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const displayD = (training?.starts_on && training.starts_on > today)
    ? new Date(training.starts_on + 'T00:00:00')
    : new Date();
  const dateStr = `${DAYS[displayD.getDay()]}, ${MONTHS[displayD.getMonth()]} ${displayD.getDate()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sched?.has_default && !loading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-8">
        <h1 className="text-xl font-bold text-white text-center">No Schedule Set Up</h1>
        <p className="text-[var(--text-3)] text-sm text-center">
          Complete your 60-day program setup to get a daily schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {/* Header */}
      <div>
        <p className="text-[var(--text-3)] text-xs">{dateStr}</p>
        <h1 className="text-xl font-bold text-white">Schedule</h1>
        {program?.active && !program.starts_tomorrow && (
          <p className="text-xs text-[var(--text-3)]">Day {program.current_day} / 60</p>
        )}
        {program?.starts_tomorrow && (
          <p className="text-xs text-emerald-400 font-semibold">Day 1 starts tomorrow — get some rest 🌙</p>
        )}
      </div>

      {/* Completed pills */}
      {completed.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {completed.map(t => {
            const meta = TASK_META[t.key];
            return (
              <span key={t.key} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                t.late
                  ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50'
                  : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'
              }`}>
                {meta.icon} {meta.label} {t.late ? '⚠' : '✓'}
              </span>
            );
          })}
        </div>
      )}

      {/* All done */}
      {allDone && (
        <Card className="flex flex-col items-center py-8 gap-3">
          <span className="text-5xl">🎉</span>
          <h2 className="text-xl font-black text-white">Day Complete!</h2>
          <p className="text-sm text-[var(--text-3)]">You crushed today. Rest up.</p>
        </Card>
      )}

      {/* Current task */}
      {currentKey && (
        <CurrentCard
          taskKey={currentKey}
          sched={sched}
          training={training}
          stretch={stretch}
          onAction={handleAction}
          onReload={reload}
        />
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">Up Next</h2>
          <Card className="py-1 px-4">
            {upcoming.map(t => {
              const meta = TASK_META[t.key];
              const time = taskScheduledTime(t.key, sched);
              return (
                <div key={t.key} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                  <span className="text-base w-6 text-center">{meta.icon}</span>
                  <span className="text-sm text-[var(--text-2)] flex-1">{meta.label}</span>
                  {time && <span className="text-xs text-[var(--text-3)]">{fmtTime(time)}</span>}
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <div className="h-2" />
    </div>
  );
}
