'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Clock, ChevronRight, Zap, AlertCircle } from 'lucide-react';
import Card from '../../../design-system/Card.jsx';
import Button from '../../../design-system/Button.jsx';
import { getProgramStatus } from '../../../api/programApi.js';
import { getTodayPresence, clockInPresence } from '../../../api/wakePresenceApi.js';
import { getTodayTraining, checkinTraining } from '../../../api/trainingCheckinApi.js';
import { getTodayStretch, checkinStretch } from '../../../api/stretchCheckinApi.js';
import { getScheduleDay, coldPlungeDone, showerStart, showerComplete } from '../../../api/scheduleApi.js';
import toast from 'react-hot-toast';

function parseHHMM(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function nowMins() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function formatCountdown(totalSecs) {
  if (totalSecs <= 0) return '00:00';
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function secsUntil(hhmm) {
  if (!hhmm) return null;
  const target = parseHHMM(hhmm);
  const now = nowMins();
  let diff = target - now;
  if (diff < 0) diff += 1440; // wrap past midnight
  return diff * 60 - new Date().getSeconds();
}

export default function GamePlanPage() {
  const [schedule, setSchedule] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [acting, setActing] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const loadAll = useCallback(async () => {
    const [prog, wake, train, stretch, sched] = await Promise.allSettled([
      getProgramStatus(),
      getTodayPresence(),
      getTodayTraining(),
      getTodayStretch(),
      getScheduleDay(today),
    ]);

    const s = prog.status === 'fulfilled' ? prog.value.data?.schedule : null;
    setSchedule(s);

    const wakeRec  = wake.status   === 'fulfilled' ? wake.value.data?.record   : null;
    const trainRec = train.status  === 'fulfilled' ? train.value.data?.checkin : null;
    const stretchRec = stretch.status === 'fulfilled' ? stretch.value.data?.checkin : null;
    const dayPlan  = sched.status  === 'fulfilled' ? sched.value.data          : null;

    setStatuses({
      wake:    { done: !!wakeRec?.clocked_in_at,         late: !!wakeRec?.late_wakeup },
      plunge:  { done: !!dayPlan?.cold_plunge_done_at },
      train:   { done: trainRec?.status === 'completed' || trainRec?.status === 'passed', late: !!trainRec?.late_checkin },
      shower:  { done: !!dayPlan?.shower_completed_at },
      stretch: { done: stretchRec?.status === 'completed' || stretchRec?.status === 'passed' },
    });
    setLoading(false);
  }, [today]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Live timer tick
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const tasks = schedule ? [
    { key: 'wake',    label: 'Wake Up',     emoji: '⏰', time: schedule.wake_time,        actionLabel: 'Clock In',  canCheckin: true },
    { key: 'plunge',  label: 'Cold Plunge', emoji: '🧊', time: schedule.cold_plunge_time, actionLabel: 'Done',      canCheckin: true },
    { key: 'train',   label: 'Training',    emoji: '💪', time: schedule.train_time,       actionLabel: 'Check In',  canCheckin: true },
    { key: 'shower',  label: 'Shower',      emoji: '🚿', time: schedule.shower_time,      actionLabel: 'Done',      canCheckin: true },
    { key: 'stretch', label: 'Stretch',     emoji: '🤸', time: schedule.stretch_time,     actionLabel: 'Check In',  canCheckin: true },
    { key: 'bed',     label: 'Bedtime',     emoji: '🌙', time: schedule.bedtime,          actionLabel: null,        canCheckin: false },
  ].filter(t => t.time) : [];

  // Find first not-done task (next one coming up)
  const nextTaskIdx = tasks.findIndex(t => t.key !== 'bed' && !statuses[t.key]?.done);
  const nextTask    = nextTaskIdx !== -1 ? tasks[nextTaskIdx] : null;
  const countdown   = nextTask ? secsUntil(nextTask.time) : null;

  async function handleAction(task) {
    setActing(task.key);
    try {
      if (task.key === 'wake')    await clockInPresence();
      if (task.key === 'plunge')  await coldPlungeDone();
      if (task.key === 'train')   await checkinTraining();
      if (task.key === 'shower')  {
        if (!statuses.shower?.started) {
          await showerStart();
        } else {
          await showerComplete();
        }
      }
      if (task.key === 'stretch') await checkinStretch();
      toast.success(`${task.label} checked in!`);
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to check in');
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <div className="h-7 w-32 bg-[var(--card)] rounded-xl animate-pulse" />
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-[var(--card)] rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] px-6 gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-[var(--text-3)]" />
        <h2 className="text-xl font-bold text-white">No Program Active</h2>
        <p className="text-[var(--text-2)] text-sm">Set up your program to use Game Plan.</p>
      </div>
    );
  }

  const doneCount = tasks.filter(t => t.key !== 'bed' && statuses[t.key]?.done).length;
  const totalCheckable = tasks.filter(t => t.key !== 'bed').length;

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Game Plan</h1>
        <p className="text-[var(--text-3)] text-sm">{doneCount} of {totalCheckable} tasks done today</p>
      </div>

      {/* Next task countdown */}
      {nextTask && (
        <Card className="bg-[var(--accent)]/10 border border-[var(--accent)]/25 flex flex-col items-center py-5 gap-2">
          <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider">Next Up</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl">{nextTask.emoji}</span>
            <span className="text-xl font-black text-white">{nextTask.label}</span>
          </div>
          <p className="text-[var(--text-2)] text-sm">{formatTime(nextTask.time)}</p>
          {countdown !== null && countdown > 0 ? (
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-2xl font-black text-white tabular-nums">{formatCountdown(countdown)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">Time to go!</span>
            </div>
          )}
          {nextTask.canCheckin && (
            <Button
              variant="primary"
              size="sm"
              loading={acting === nextTask.key}
              onClick={() => handleAction(nextTask)}
              className="mt-2"
            >
              {nextTask.actionLabel}
            </Button>
          )}
        </Card>
      )}

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {tasks.map((task, idx) => {
          const status = statuses[task.key] || {};
          const done = status.done;
          const late = status.late;
          const isNext = idx === nextTaskIdx;
          const isPast = !done && !isNext && parseHHMM(task.time) < nowMins();

          return (
            <Card
              key={task.key}
              className={`flex items-center gap-3 ${
                done
                  ? 'opacity-70'
                  : isNext
                  ? 'border border-[var(--accent)]/30'
                  : ''
              }`}
            >
              <div className="shrink-0">
                {done ? (
                  <CheckCircle2 className={`w-6 h-6 ${late ? 'text-yellow-400' : 'text-emerald-400'}`} />
                ) : isPast ? (
                  <AlertCircle className="w-6 h-6 text-[var(--danger)]" />
                ) : (
                  <Circle className={`w-6 h-6 ${isNext ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`} />
                )}
              </div>

              <span className="text-xl">{task.emoji}</span>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${done ? 'line-through text-[var(--text-3)]' : isNext ? 'text-[var(--accent)]' : 'text-white'}`}>
                  {task.label}
                </p>
                <p className="text-xs text-[var(--text-3)]">{formatTime(task.time)}</p>
                {done && late && <p className="text-[10px] text-yellow-400">Completed late</p>}
                {done && !late && <p className="text-[10px] text-emerald-400">On time</p>}
              </div>

              {!done && task.canCheckin && !isNext && (
                <button
                  onClick={() => handleAction(task)}
                  disabled={!!acting}
                  className="shrink-0 p-2 rounded-xl bg-[var(--card-2)] text-[var(--text-3)] active:opacity-70 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {/* All done */}
      {doneCount === totalCheckable && totalCheckable > 0 && (
        <Card className="flex flex-col items-center py-6 gap-2">
          <span className="text-4xl">🏆</span>
          <p className="text-lg font-black text-white">All done for today!</p>
          <p className="text-[var(--text-3)] text-sm">Perfect execution. Rest up.</p>
        </Card>
      )}

      <div className="h-4" />
    </div>
  );
}
