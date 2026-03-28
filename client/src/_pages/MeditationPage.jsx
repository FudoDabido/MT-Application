'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getTodaySession, startSession, confirmPresence, failSession, getMeditationMode, setMeditationMode } from '../api/meditationApi.js';
import { getConsistencyScore } from '../api/consistencyApi.js';
import { getProgramStatus } from '../api/programApi.js';
import { useAuth } from '../context/AuthContext.jsx';

// ── Admin-only meditation overview ────────────────────────────────────────────
function AdminMeditationView() {
  const [session, setSession] = useState(undefined);
  const [score, setScore]     = useState(null);
  const [schedTime, setSchedTime] = useState(null);

  useEffect(() => {
    Promise.all([getTodaySession(), getConsistencyScore(), getProgramStatus()])
      .then(([s, c, p]) => {
        setSession(s.data.session ?? null);
        setScore(c.data);
        setSchedTime(p.data?.schedule?.meditate_eve_time ?? null);
      })
      .catch(() => setSession(null));
  }, []);

  if (session === undefined) return <div className="flex justify-center py-20 text-gray-400">Loading...</div>;

  const status = session?.status ?? 'idle';
  const st = {
    passed: { color: 'text-emerald-400', border: 'border-emerald-700', bg: 'bg-emerald-900/30', icon: '✓', label: 'Complete' },
    failed: { color: 'text-red-400',     border: 'border-red-800',     bg: 'bg-red-900/30',     icon: '✗', label: 'Failed' },
    active: { color: 'text-purple-400',  border: 'border-purple-700',  bg: 'bg-purple-900/20',  icon: '🧘', label: 'In Progress' },
    idle:   { color: 'text-gray-400',    border: 'border-gray-700',    bg: 'bg-gray-900',       icon: '—',  label: 'Not Started' },
  }[status] || { color: 'text-gray-400', border: 'border-gray-700', bg: 'bg-gray-900', icon: '—', label: 'Not Started' };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Meditation</h1>
        <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest mt-0.5">Admin overview</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-5 text-center">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Scheduled</div>
          <div className="text-5xl font-black text-white tabular-nums">{schedTime ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">evening meditation</div>
        </div>
        <div className={`rounded-xl p-5 text-center border ${st.bg} ${st.border}`}>
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Today</div>
          <div className={`text-4xl font-black ${st.color}`}>{st.icon}</div>
          <div className={`text-sm font-bold mt-1 ${st.color}`}>{st.label}</div>
        </div>
      </div>
      {score && (
        <div className="bg-gray-900 rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">Scores</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Consistency',  value: `${score.consistency}%`,          color: 'text-emerald-400' },
              { label: 'Pertinence',   value: `${score.pertinence}%`,           color: 'text-blue-400' },
              { label: 'Days Trained', value: score.breakdown?.days_trained ?? '—', color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PRESENCE_WINDOW = 15;

// ── Web Audio alarm ───────────────────────────────────────────────────────────
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1100, 880, 1100, 660];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.6, ctx.currentTime + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.4 + 0.35);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.4);
    });
  } catch {}
}

// ── SVG circle progress ───────────────────────────────────────────────────────
function CircleTimer({ remaining, total, phase }) {
  const R = 110;
  const C = 2 * Math.PI * R;
  const dash = C * (remaining / total);
  const colors = { idle: '#6b7280', active: '#10b981', presence: '#f59e0b', passed: '#10b981', failed: '#ef4444' };
  const color  = colors[phase] || colors.active;
  const mins   = Math.floor(remaining / 60);
  const secs   = remaining % 60;
  const label  = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
      <svg width="260" height="260" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="130" cy="130" r={R} fill="none" stroke="#1f2937" strokeWidth="12" />
        <circle cx="130" cy="130" r={R} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-5xl font-black text-white tabular-nums">{label}</span>
        {phase === 'active'   && <span className="text-xs text-gray-400 mt-1 uppercase tracking-widest">remaining</span>}
        {phase === 'presence' && <span className="text-xs text-yellow-400 mt-1 uppercase tracking-widest animate-pulse">confirm!</span>}
        {phase === 'passed'   && <span className="text-xs text-emerald-400 mt-1 uppercase tracking-widest">complete ✓</span>}
        {phase === 'failed'   && <span className="text-xs text-red-400 mt-1 uppercase tracking-widest">failed ✗</span>}
      </div>
    </div>
  );
}

function ScoreWidget({ score }) {
  if (!score) return null;
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex gap-6 justify-center">
      <div className="text-center">
        <div className="text-2xl font-black text-emerald-400">{score.consistency}%</div>
        <div className="text-xs text-gray-400 mt-0.5">Consistency</div>
      </div>
      <div className="w-px bg-gray-700" />
      <div className="text-center">
        <div className="text-2xl font-black text-blue-400">{score.pertinence}%</div>
        <div className="text-xs text-gray-400 mt-0.5">Pertinence</div>
      </div>
      <div className="w-px bg-gray-700" />
      <div className="text-center">
        <div className="text-2xl font-black text-purple-400">{score.breakdown?.days_trained ?? '—'}</div>
        <div className="text-xs text-gray-400 mt-0.5">Days trained</div>
      </div>
    </div>
  );
}


// ── Single session timer block ────────────────────────────────────────────────
function SessionBlock({ label, durationSecs, session, onStart, onConfirm, onFail, onReset }) {
  const [phase, setPhase]                     = useState('idle');
  const [remaining, setRemaining]             = useState(durationSecs);
  const [presenceRemaining, setPresenceRem]   = useState(PRESENCE_WINDOW);
  const timerRef    = useRef(null);
  const presenceRef = useRef(null);
  const alarmFired  = useRef(false);

  // Sync phase from server session
  useEffect(() => {
    if (!session) { setPhase('idle'); setRemaining(durationSecs); return; }
    if (session.status === 'passed') { setPhase('passed'); return; }
    if (session.status === 'failed') { setPhase('failed'); return; }
    if (session.status === 'active') {
      const elapsed = Math.floor((Date.now() - new Date(session.started_at + 'Z').getTime()) / 1000);
      const rem = Math.max(0, durationSecs - elapsed);
      setRemaining(rem);
      setPhase(rem > 0 ? 'active' : 'presence');
    }
  }, [session, durationSecs]);

  // Countdown
  useEffect(() => {
    if (phase !== 'active') return;
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          if (!alarmFired.current) { alarmFired.current = true; playAlarm(); }
          setPhase('presence');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Presence countdown
  useEffect(() => {
    if (phase !== 'presence') return;
    setPresenceRem(PRESENCE_WINDOW);
    presenceRef.current = setInterval(() => {
      setPresenceRem(p => {
        if (p <= 1) { clearInterval(presenceRef.current); onFail(session); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(presenceRef.current);
  }, [phase]);

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest">{label}</div>}

      <CircleTimer
        remaining={phase === 'presence' ? presenceRemaining : remaining}
        total={phase === 'presence' ? PRESENCE_WINDOW : durationSecs}
        phase={phase}
      />

      <div className="flex flex-col items-center gap-3 w-full">
        {phase === 'idle' && (
          <button onClick={() => { alarmFired.current = false; onStart(); }}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg transition-colors">
            🧘 Begin {label || 'Meditation'}
          </button>
        )}
        {phase === 'active' && (
          <div className="w-full bg-gray-900 rounded-xl p-4 text-center text-gray-400 text-sm">
            Keep your device nearby. The alarm will sound when the time is up.
            <br />You have <span className="text-yellow-400 font-bold">15 seconds</span> to confirm.
          </div>
        )}
        {phase === 'presence' && (
          <button onClick={() => { clearInterval(presenceRef.current); onConfirm(session); setPhase('passed'); }}
            className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-xl transition-all animate-pulse shadow-lg shadow-yellow-500/30">
            ✋ I'm Here — {presenceRemaining}s
          </button>
        )}
        {phase === 'passed' && (
          <div className="w-full bg-emerald-900/40 border border-emerald-700 rounded-xl p-5 text-center">
            <div className="text-emerald-400 text-2xl font-black mb-1">✓ Done</div>
            <div className="text-emerald-300 text-sm">Session logged</div>
          </div>
        )}
        {phase === 'failed' && (
          <div className="flex flex-col gap-3 w-full">
            <div className="w-full bg-red-900/40 border border-red-800 rounded-xl p-4 text-center text-red-300 text-sm">
              Presence not confirmed in time.
            </div>
            <button onClick={() => { setPhase('idle'); setRemaining(durationSecs); alarmFired.current = false; onReset(); }}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors">
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MeditationPage() {
  return <UserMeditationView />;
}

// ── User view ─────────────────────────────────────────────────────────────────
function UserMeditationView() {
  const [data, setData]         = useState(null);
  const [score, setScore]       = useState(null);
  const [loading, setLoading]   = useState(true);

  function load() {
    return Promise.all([getTodaySession(), getConsistencyScore()])
      .then(([s, c]) => { setData(s.data); setScore(c.data); })
      .catch(() => {});
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function handleStart() {
    try { await startSession(null); await load(); } catch(e) { console.error(e); }
  }

  async function handleConfirm(session) {
    try { await confirmPresence(session.id); await load(); } catch {}
  }

  async function handleFail(session) {
    try { await failSession(session.id); await load(); } catch {}
  }

  if (loading) return <div className="flex justify-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto pt-4">
      <h1 className="text-2xl font-bold text-white">Meditation</h1>

      <SessionBlock
        durationSecs={60 * 60}
        session={data?.session}
        onStart={handleStart}
        onConfirm={handleConfirm}
        onFail={handleFail}
        onReset={() => {}}
      />

      <ScoreWidget score={score} />

      <div className="w-full bg-gray-900 rounded-xl p-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">The Three Pillars</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: '💪', label: 'Train',    color: 'text-emerald-400', sub: '1h morning' },
            { icon: '🧘', label: 'Meditate', color: 'text-purple-400',  sub: '1h morning' },
            { icon: '🤸', label: 'Stretch',  color: 'text-blue-400',    sub: '30min before bed' },
          ].map(p => (
            <div key={p.label} className="bg-gray-800 rounded-lg p-3">
              <div className="text-xl">{p.icon}</div>
              <div className={`text-xs font-bold mt-1 ${p.color}`}>{p.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{p.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
