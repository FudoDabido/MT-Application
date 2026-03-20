import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getTodaySession, startSession, confirmPresence, failSession } from '../api/meditationApi.js';
import { getConsistencyScore } from '../api/consistencyApi.js';

const DURATION_SECS = 60 * 60; // 1 hour
const PRESENCE_WINDOW = 15;     // seconds to confirm presence after alarm

// ── Web Audio alarm ──────────────────────────────────────────────────────────
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1100, 880, 1100, 660];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
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
  const pct = remaining / total;
  const dash = C * pct;

  const colors = {
    idle:     '#6b7280',
    active:   '#10b981',
    presence: '#f59e0b',
    passed:   '#10b981',
    failed:   '#ef4444',
  };
  const color = colors[phase] || colors.active;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
      <svg width="260" height="260" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="130" cy="130" r={R} fill="none" stroke="#1f2937" strokeWidth="12" />
        {/* Progress */}
        <circle
          cx="130" cy="130" r={R}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dash} ${C}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-5xl font-black text-white tabular-nums">{label}</span>
        {phase === 'active' && <span className="text-xs text-gray-400 mt-1 uppercase tracking-widest">remaining</span>}
        {phase === 'presence' && <span className="text-xs text-yellow-400 mt-1 uppercase tracking-widest animate-pulse">confirm!</span>}
        {phase === 'passed'   && <span className="text-xs text-emerald-400 mt-1 uppercase tracking-widest">complete ✓</span>}
        {phase === 'failed'   && <span className="text-xs text-red-400 mt-1 uppercase tracking-widest">failed ✗</span>}
      </div>
    </div>
  );
}

// ── Consistency Score Widget ──────────────────────────────────────────────────
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MeditationPage() {
  // session from server
  const [session, setSession] = useState(null);  // null = not loaded yet
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  // timer state
  const [phase, setPhase] = useState('idle');     // idle | active | presence | passed | failed
  const [remaining, setRemaining] = useState(DURATION_SECS);
  const [presenceRemaining, setPresenceRemaining] = useState(PRESENCE_WINDOW);

  const timerRef    = useRef(null);
  const presenceRef = useRef(null);
  const alarmFired  = useRef(false);

  // ── Load today's session on mount ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([getTodaySession(), getConsistencyScore()])
      .then(([s, c]) => {
        setScore(c.data);
        const sess = s.data.session;
        setSession(sess);
        if (sess) {
          if (sess.status === 'passed') setPhase('passed');
          else if (sess.status === 'failed') setPhase('failed');
          else if (sess.status === 'active') {
            // Resume from where we left off based on started_at
            const elapsed = Math.floor((Date.now() - new Date(sess.started_at + 'Z').getTime()) / 1000);
            const rem = Math.max(0, DURATION_SECS - elapsed);
            setRemaining(rem);
            if (rem > 0) {
              setPhase('active');
            } else {
              setPhase('presence');
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Main countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return;
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          if (!alarmFired.current) {
            alarmFired.current = true;
            playAlarm();
          }
          setPhase('presence');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Presence countdown (15s after alarm) ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'presence') return;
    setPresenceRemaining(PRESENCE_WINDOW);
    presenceRef.current = setInterval(() => {
      setPresenceRemaining(p => {
        if (p <= 1) {
          clearInterval(presenceRef.current);
          handleFail();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(presenceRef.current);
  }, [phase]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleStart() {
    try {
      const res = await startSession();
      setSession(res.data.session);
      setRemaining(DURATION_SECS);
      alarmFired.current = false;
      setPhase('active');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirm() {
    if (!session) return;
    clearInterval(presenceRef.current);
    try {
      await confirmPresence(session.id);
      setPhase('passed');
    } catch {}
  }

  async function handleFail() {
    if (!session) return;
    try {
      await failSession(session.id);
      setPhase('failed');
    } catch {}
  }

  async function handleRestart() {
    setPhase('idle');
    setSession(null);
    setRemaining(DURATION_SECS);
    alarmFired.current = false;
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-8 max-w-lg mx-auto pt-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Meditation</h1>
        <p className="text-gray-400 text-sm mt-1">
          {phase === 'idle'     && 'Minimum 1 hour · Be present · Confirm when done'}
          {phase === 'active'   && 'Stay focused · Your timer is running'}
          {phase === 'presence' && 'Session complete! Confirm you\'re here within 15 seconds'}
          {phase === 'passed'   && 'Excellent — meditation logged for today ✓'}
          {phase === 'failed'   && 'Session failed — presence not confirmed in time'}
        </p>
      </div>

      {/* Timer circle */}
      <CircleTimer
        remaining={phase === 'presence' ? presenceRemaining : remaining}
        total={phase === 'presence' ? PRESENCE_WINDOW : DURATION_SECS}
        phase={phase}
      />

      {/* Action button */}
      <div className="flex flex-col items-center gap-3 w-full">
        {phase === 'idle' && (
          <button
            onClick={handleStart}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg transition-colors"
          >
            🧘 Begin Meditation
          </button>
        )}

        {phase === 'active' && (
          <div className="w-full bg-gray-900 rounded-xl p-4 text-center text-gray-400 text-sm">
            Keep your device nearby. The alarm will sound when the hour is up.
            <br />
            You will have <span className="text-yellow-400 font-bold">15 seconds</span> to confirm your presence.
          </div>
        )}

        {phase === 'presence' && (
          <button
            onClick={handleConfirm}
            className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-xl transition-all animate-pulse shadow-lg shadow-yellow-500/30"
          >
            ✋ I'm Here — {presenceRemaining}s
          </button>
        )}

        {phase === 'passed' && (
          <div className="w-full bg-emerald-900/40 border border-emerald-700 rounded-xl p-5 text-center">
            <div className="text-emerald-400 text-2xl font-black mb-1">+25 pts</div>
            <div className="text-emerald-300 text-sm">Meditation complete · Consistency boosted</div>
          </div>
        )}

        {phase === 'failed' && (
          <div className="flex flex-col gap-3 w-full">
            <div className="w-full bg-red-900/40 border border-red-800 rounded-xl p-4 text-center text-red-300 text-sm">
              You didn't confirm presence in time. Try again tomorrow.
            </div>
            <button
              onClick={handleRestart}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
            >
              Reset for next attempt
            </button>
          </div>
        )}
      </div>

      {/* Score widget */}
      <ScoreWidget score={score} />

      {/* The Three Pillars info */}
      <div className="w-full bg-gray-900 rounded-xl p-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">The Three Pillars</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: '💪', label: 'Train', color: 'text-emerald-400', sub: 'Log workout' },
            { icon: '🧘', label: 'Meditate', color: 'text-purple-400', sub: '1h minimum' },
            { icon: '🤸', label: 'Stretch', color: 'text-blue-400', sub: '30min before bed' },
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
