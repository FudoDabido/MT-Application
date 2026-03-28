'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  getTodayStretch,
  checkinStretch,
  completeStretch,
  getStretchStats,
} from '../api/stretchCheckinApi.js';
import { useAuth } from '../context/AuthContext.jsx';

// ── Admin-only stretch overview ───────────────────────────────────────────────
function AdminStretchView() {
  const [data, setData]   = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([getTodayStretch(), getStretchStats()])
      .then(([d, s]) => { setData(d.data); setStats(s.data); })
      .catch(() => {});
  }, []);

  if (!data) return <div className="flex justify-center py-20 text-gray-400">Loading...</div>;

  const { checkin, stretch_time, exercises } = data;
  const status = checkin?.status ?? 'pending';

  const st = {
    completed: { color: 'text-emerald-400', border: 'border-emerald-700', bg: 'bg-emerald-900/30', icon: '✓', label: 'Completed' },
    active:    { color: 'text-blue-400',    border: 'border-blue-700',    bg: 'bg-blue-900/20',    icon: '🤸', label: 'In Progress' },
    failed:    { color: 'text-red-400',     border: 'border-red-800',     bg: 'bg-red-900/30',     icon: '✗', label: 'Missed' },
    pending:   { color: 'text-blue-400',    border: 'border-gray-700',    bg: 'bg-gray-900',       icon: '⏰', label: 'Scheduled' },
  }[status] || { color: 'text-blue-400', border: 'border-gray-700', bg: 'bg-gray-900', icon: '⏰', label: 'Scheduled' };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Stretching</h1>
        <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest mt-0.5">Admin overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-5 text-center">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Scheduled</div>
          <div className="text-5xl font-black text-white tabular-nums">{stretch_time ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">stretch time · 10 min window</div>
        </div>
        <div className={`rounded-xl p-5 text-center border ${st.bg} ${st.border}`}>
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Today</div>
          <div className={`text-4xl font-black ${st.color}`}>{st.icon}</div>
          <div className={`text-sm font-bold mt-1 ${st.color}`}>{st.label}</div>
          {checkin?.completed_at && (
            <div className="text-xs text-gray-500 mt-1">
              at {new Date(checkin.completed_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {exercises?.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
            Stretches ({exercises.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {exercises.map((ex, i) => (
              <div key={ex.id} className="bg-gray-800 rounded-lg px-3 py-2 flex items-start gap-2">
                <span className="text-xs text-gray-600 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                <div>
                  <div className="text-sm text-white">{ex.name}</div>
                  {ex.muscle_group && (
                    <div className="text-xs text-gray-500 mt-0.5">{muscleLabel(ex.muscle_group)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="bg-gray-900 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">Stats</div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Streak',  value: stats.streak,       color: 'text-emerald-400' },
              { label: 'Best',    value: stats.best_streak,  color: 'text-yellow-400' },
              { label: 'Done',    value: stats.passed,       color: 'text-blue-400' },
              { label: 'Missed',  value: stats.failed,       color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className={`text-2xl font-black ${s.color}`}>{s.value ?? '—'}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function pad(n) { return String(n).padStart(2, '0'); }

const WINDOW_MINS = 10;

function getWindowState(stretchTime) {
  if (!stretchTime) return { phase: 'no-schedule' };
  const [sh, sm] = stretchTime.split(':').map(Number);
  const now = new Date();
  const windowStart = new Date(now); windowStart.setHours(sh, sm, 0, 0);
  const windowEnd   = new Date(now); windowEnd.setHours(sh, sm + WINDOW_MINS, 0, 0);

  if (now < windowStart) {
    return { phase: 'waiting', secsUntil: Math.ceil((windowStart - now) / 1000) };
  }
  if (now <= windowEnd) {
    return { phase: 'open', secsLeft: Math.ceil((windowEnd - now) / 1000) };
  }
  return { phase: 'closed' };
}

function fmtSecs(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

function muscleLabel(muscle) {
  if (!muscle) return '';
  return muscle.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function StretchPresencePage() {
  const { user } = useAuth();
  return user?.is_admin ? <AdminStretchView /> : <UserStretchView />;
}

function UserStretchView() {
  const [phase, setPhase]           = useState('loading');
  const [checkin, setCheckin]       = useState(null);
  const [stretchTime, setStretchTime] = useState(null);
  const [exercises, setExercises]   = useState([]);
  const [windowState, setWindowState] = useState({});
  const [busy, setBusy]             = useState(false);
  const tickRef = useRef(null);

  async function load() {
    try {
      const res = await getTodayStretch();
      const { checkin: c, stretch_time, exercises: exs } = res.data;
      setCheckin(c);
      setStretchTime(stretch_time);
      setExercises(exs || []);

      if (!stretch_time || !c) {
        setPhase('no-schedule');
        return;
      }

      if (c.status === 'active')    { setPhase('active'); return; }
      if (c.status === 'completed') { setPhase('completed'); return; }
      if (c.status === 'failed')    { setPhase('failed'); return; }

      // status === 'pending'
      const ws = getWindowState(stretch_time);
      if (ws.phase === 'closed') {
        setPhase('failed');
      } else {
        setPhase(ws.phase === 'open' ? 'window-open' : 'waiting');
      }
    } catch {
      setPhase('no-schedule');
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Tick every second for countdown
  useEffect(() => {
    if (!stretchTime) return;
    setWindowState(getWindowState(stretchTime));
    tickRef.current = setInterval(() => {
      const ws = getWindowState(stretchTime);
      setWindowState(ws);
      setPhase(prev => {
        if (prev === 'active' || prev === 'completed' || prev === 'failed' || prev === 'no-schedule' || prev === 'loading') return prev;
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
    } catch {
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setBusy(true);
    try {
      const res = await completeStretch();
      setCheckin(res.data.checkin);
      setPhase('completed');
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'loading') {
    return <div className="flex justify-center py-20 text-gray-400">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto pt-6">
      {/* Header */}
      <div className="text-center w-full">
        <h1 className="text-2xl font-bold text-white">Stretching</h1>
        <p className="text-gray-400 text-sm mt-1">
          Check in within 10 minutes of your scheduled stretch time
        </p>
      </div>

      {/* Scheduled time */}
      <div className="bg-gray-900 rounded-2xl p-6 w-full text-center">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Scheduled Stretch</div>
        <div className="text-6xl font-black text-white tabular-nums">
          {stretchTime ?? '—'}
        </div>
        <div className="text-xs text-gray-500 mt-2">10-minute window to check in</div>
      </div>

      {/* Status sections */}
      {phase === 'no-schedule' && (
        <div className="w-full bg-gray-900 rounded-xl p-5 text-center text-gray-400 text-sm">
          No stretch schedule found. Complete your program setup to enable stretch check-ins.
        </div>
      )}

      {phase === 'waiting' && (
        <div className="flex flex-col gap-4 w-full">
          <div className="w-full bg-gray-900 rounded-xl p-6 text-center">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Window opens in</div>
            <div className="text-5xl font-black text-blue-400 tabular-nums">
              {windowState.secsUntil != null ? fmtSecs(windowState.secsUntil) : '—'}
            </div>
            <div className="text-gray-500 text-sm mt-2">Prepare your stretching space</div>
          </div>

          {exercises.length > 0 && (
            <div className="w-full bg-gray-900 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
                Stretches to Prepare ({exercises.length})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {exercises.map(ex => (
                  <div key={ex.id} className="bg-gray-800 rounded-lg px-3 py-2">
                    <div className="text-sm text-white">{ex.name}</div>
                    {ex.muscle_group && (
                      <div className="text-xs text-gray-500 mt-0.5">{muscleLabel(ex.muscle_group)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'window-open' && (
        <div className="flex flex-col gap-4 w-full items-center">
          <div className="text-center">
            <div className="text-xs text-yellow-400 uppercase tracking-widest mb-1 animate-pulse">Window open!</div>
            <div className="text-4xl font-black text-yellow-400 tabular-nums">
              {windowState.secsLeft != null ? fmtSecs(windowState.secsLeft) : '—'}
            </div>
            <div className="text-gray-500 text-xs mt-1">remaining</div>
          </div>
          <button
            onClick={handleCheckin}
            disabled={busy}
            className="w-full py-6 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl text-2xl transition-all animate-pulse shadow-lg shadow-yellow-500/40"
          >
            ✋ Check In
          </button>

          {exercises.length > 0 && (
            <div className="w-full bg-gray-900 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
                Today's Stretches
              </div>
              <div className="grid grid-cols-2 gap-2">
                {exercises.map(ex => (
                  <div key={ex.id} className="bg-gray-800 rounded-lg px-3 py-2">
                    <div className="text-sm text-white">{ex.name}</div>
                    {ex.muscle_group && (
                      <div className="text-xs text-gray-500 mt-0.5">{muscleLabel(ex.muscle_group)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'active' && (
        <div className="flex flex-col gap-4 w-full">
          <div className="w-full bg-blue-900/30 border border-blue-700/50 rounded-xl p-3 text-center">
            <div className="text-blue-400 text-sm font-bold">Stretching in progress</div>
            <div className="text-blue-300 text-xs mt-0.5">Work through all {exercises.length} stretches, then tap Complete</div>
          </div>

          {exercises.length > 0 ? (
            <div className="w-full bg-gray-900 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
                All Stretches ({exercises.length})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {exercises.map((ex, i) => (
                  <div key={ex.id} className="bg-gray-800 rounded-lg px-3 py-2 flex items-start gap-2">
                    <span className="text-xs text-gray-600 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                    <div>
                      <div className="text-sm text-white">{ex.name}</div>
                      {ex.muscle_group && (
                        <div className="text-xs text-gray-500 mt-0.5">{muscleLabel(ex.muscle_group)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full bg-gray-900 rounded-xl p-4 text-center text-gray-400 text-sm">
              No stretching exercises found.
            </div>
          )}

          <button
            onClick={handleComplete}
            disabled={busy}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl text-lg transition-colors"
          >
            {busy ? 'Saving...' : 'Complete Stretching ✓'}
          </button>
        </div>
      )}

      {phase === 'completed' && (
        <div className="w-full bg-emerald-900/40 border border-emerald-700 rounded-xl p-6 text-center">
          <div className="text-5xl mb-3">✓</div>
          <div className="text-emerald-400 text-xl font-black">Stretching Complete</div>
          <div className="text-emerald-300 text-sm mt-1">
            {checkin?.completed_at
              ? `Completed at ${new Date(checkin.completed_at + 'Z').toLocaleTimeString()}`
              : 'Great flexibility work today!'}
          </div>
          {exercises.length > 0 && (
            <div className="text-gray-500 text-xs mt-2">{exercises.length} stretches completed</div>
          )}
        </div>
      )}

      {phase === 'failed' && (
        <div className="w-full bg-red-900/40 border border-red-800 rounded-xl p-6 text-center">
          <div className="text-5xl mb-3">✗</div>
          <div className="text-red-400 text-xl font-black">Missed</div>
          <div className="text-red-300 text-sm mt-1">You didn't check in during the stretch window. Try again tomorrow.</div>
        </div>
      )}

      {/* Today's date */}
      <div className="text-gray-600 text-xs pb-2">
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
}
