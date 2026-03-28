'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  getTodayStretch, checkinStretch, completeStretch,
} from '../../../api/stretchCheckinApi.js';
import Card from '../../../design-system/Card.jsx';
import Badge from '../../../design-system/Badge.jsx';
import Button from '../../../design-system/Button.jsx';
import Skeleton from '../../../design-system/Skeleton.jsx';

const WINDOW_MINS = 10;

function pad(n) { return String(n).padStart(2, '0'); }
function fmtSecs(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}
function muscleLabel(m) {
  return (m || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function getWindowState(stretchTime) {
  if (!stretchTime) return { phase: 'no-schedule' };
  const [sh, sm] = stretchTime.split(':').map(Number);
  const now = new Date();
  const start = new Date(now); start.setHours(sh, sm, 0, 0);
  const end   = new Date(now); end.setHours(sh, sm + WINDOW_MINS, 0, 0);
  if (now < start) return { phase: 'waiting', secsUntil: Math.ceil((start - now) / 1000) };
  if (now <= end)  return { phase: 'open',    secsLeft:  Math.ceil((end - now) / 1000) };
  return { phase: 'closed' };
}

export default function StretchPage() {
  const [phase,       setPhase]       = useState('loading');
  const [checkin,     setCheckin]     = useState(null);
  const [stretchTime, setStretchTime] = useState(null);
  const [exercises,   setExercises]   = useState([]);
  const [windowState, setWindowState] = useState({});
  const [busy,        setBusy]        = useState(false);
  const tickRef = useRef(null);

  async function load() {
    try {
      const res = await getTodayStretch();
      const { checkin: c, stretch_time, exercises: exs, starts_on } = res.data;
      setCheckin(c);
      setStretchTime(stretch_time);
      setExercises(exs || []);
      if (starts_on) { setPhase('starts-tomorrow'); return; }
      if (!stretch_time || !c) { setPhase('no-schedule'); return; }
      if (c.status === 'active')    { setPhase('active');    return; }
      if (c.status === 'completed') { setPhase('completed'); return; }
      if (c.status === 'failed')    { setPhase('failed');    return; }
      const ws = getWindowState(stretch_time);
      if (ws.phase === 'closed') setPhase('failed');
      else setPhase(ws.phase === 'open' ? 'window-open' : 'waiting');
    } catch { setPhase('no-schedule'); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!stretchTime) return;
    setWindowState(getWindowState(stretchTime));
    tickRef.current = setInterval(() => {
      const ws = getWindowState(stretchTime);
      setWindowState(ws);
      setPhase(prev => {
        if (['active','completed','failed','no-schedule','loading','starts-tomorrow'].includes(prev)) return prev;
        if (ws.phase === 'open')    return 'window-open';
        if (ws.phase === 'waiting') return 'waiting';
        if (ws.phase === 'closed')  return 'failed';
        return prev;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [stretchTime]);

  async function handleCheckin() {
    setBusy(true);
    try {
      const res = await checkinStretch();
      setCheckin(res.data.checkin);
      setPhase('active');
    } catch { await load(); } finally { setBusy(false); }
  }

  async function handleComplete() {
    setBusy(true);
    try {
      const res = await completeStretch();
      setCheckin(res.data.checkin);
      setPhase('completed');
    } catch (e) { console.error(e); } finally { setBusy(false); }
  }

  const badgeMap = {
    loading: null,
    'no-schedule': null,
    waiting: { v: 'neutral', l: 'Scheduled' },
    'window-open': { v: 'warning', l: 'Window Open' },
    active: { v: 'warning', l: 'In Progress' },
    completed: { v: 'success', l: 'Done ✓' },
    failed: { v: 'danger', l: 'Missed' },
  };
  const badge = badgeMap[phase];

  function ExerciseList({ label }) {
    if (!exercises.length) return null;
    return (
      <Card>
        {label && <div className="text-xs text-[var(--text-3)] uppercase tracking-wider font-semibold mb-2">{label}</div>}
        <div className="grid grid-cols-2 gap-2">
          {exercises.map((ex, i) => (
            <div key={ex.id} className="bg-[var(--card-2)] rounded-xl px-3 py-2.5 flex items-start gap-2">
              <span className="text-xs text-[var(--text-3)] font-bold mt-0.5 shrink-0">{i + 1}.</span>
              <div>
                <div className="text-sm text-white">{ex.name}</div>
                {ex.muscle_group && (
                  <div className="text-xs text-[var(--text-3)] mt-0.5">{muscleLabel(ex.muscle_group)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Stretching</h1>
        {badge && <Badge variant={badge.v}>{badge.l}</Badge>}
      </div>

      {phase === 'loading' ? (
        <>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-16 w-full" />
        </>
      ) : phase === 'starts-tomorrow' ? (
        <Card className="text-center py-8 flex flex-col items-center gap-3">
          <span className="text-5xl">🗓</span>
          <div className="text-white font-bold">Program starts tomorrow</div>
          <p className="text-sm text-[var(--text-2)]">Stretch check-ins begin on Day 1. Scheduled at {stretchTime}.</p>
        </Card>
      ) : phase === 'no-schedule' ? (
        <Card className="text-center py-8 flex flex-col items-center gap-3">
          <span className="text-5xl">🤸</span>
          <div className="text-white font-bold">No stretch schedule</div>
          <p className="text-sm text-[var(--text-2)]">Complete program setup to enable stretch check-ins.</p>
        </Card>
      ) : (
        <>
          {/* Scheduled time card */}
          <Card className="text-center py-5">
            <div className="text-xs text-[var(--text-3)] uppercase tracking-widest mb-1">Scheduled</div>
            <div className="text-5xl font-black text-white tabular-nums">{stretchTime ?? '—'}</div>
            <div className="text-xs text-[var(--text-3)] mt-1">10-minute check-in window</div>
          </Card>

          {/* Waiting */}
          {phase === 'waiting' && (
            <>
              <Card className="text-center py-5">
                <div className="text-xs text-[var(--text-3)] uppercase tracking-widest mb-1">Window opens in</div>
                <div className="text-5xl font-black text-blue-400 tabular-nums">
                  {windowState.secsUntil != null ? fmtSecs(windowState.secsUntil) : '—'}
                </div>
                <div className="text-xs text-[var(--text-3)] mt-1">Prepare your stretching space</div>
              </Card>
              <ExerciseList label={`Stretches to Prepare (${exercises.length})`} />
            </>
          )}

          {/* Window open */}
          {phase === 'window-open' && (
            <>
              <div className="text-center">
                <div className="text-xs text-[var(--warning)] uppercase tracking-widest mb-1 animate-pulse">Window open!</div>
                <div className="text-4xl font-black text-[var(--warning)] tabular-nums">
                  {windowState.secsLeft != null ? fmtSecs(windowState.secsLeft) : '—'}
                </div>
                <div className="text-xs text-[var(--text-3)] mt-1">remaining</div>
              </div>
              <button onClick={handleCheckin} disabled={busy}
                className="w-full py-6 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-2xl text-2xl transition-all animate-pulse shadow-lg shadow-yellow-500/40">
                ✋ Check In
              </button>
              <ExerciseList label={`Today's Stretches (${exercises.length})`} />
            </>
          )}

          {/* Active */}
          {phase === 'active' && (
            <>
              <Card className="border border-blue-800 text-center">
                <div className="text-blue-400 text-sm font-bold">Stretching in progress 🤸</div>
                <div className="text-[var(--text-3)] text-xs mt-0.5">
                  Work through all {exercises.length} stretches, then tap Complete
                </div>
              </Card>
              <ExerciseList label={`All Stretches (${exercises.length})`} />
              <Button onClick={handleComplete} loading={busy} fullWidth size="lg" className="rounded-2xl font-black text-lg">
                Complete Stretching ✓
              </Button>
            </>
          )}

          {/* Completed */}
          {phase === 'completed' && (
            <Card className="border border-[var(--accent-dim)] text-center py-8 flex flex-col items-center gap-3">
              <span className="text-6xl">✓</span>
              <div className="text-[var(--accent)] text-2xl font-black">Stretching Complete</div>
              <div className="text-[var(--text-2)] text-sm">
                {checkin?.completed_at
                  ? `Completed at ${new Date(checkin.completed_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Great flexibility work today!'}
              </div>
              {exercises.length > 0 && (
                <div className="text-[var(--text-3)] text-xs">{exercises.length} stretches completed</div>
              )}
            </Card>
          )}

          {/* Failed */}
          {phase === 'failed' && (
            <Card className="border border-red-900 text-center py-8 flex flex-col items-center gap-3">
              <span className="text-6xl">✗</span>
              <div className="text-[var(--danger)] text-2xl font-black">Missed</div>
              <div className="text-[var(--text-2)] text-sm">
                You didn't check in during the stretch window. Try again tomorrow.
              </div>
            </Card>
          )}
        </>
      )}

      <div className="h-2" />
    </div>
  );
}
