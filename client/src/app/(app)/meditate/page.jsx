'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  getTodaySession, startSession, confirmPresence, failSession,
} from '../../../api/meditationApi.js';
import { getConsistencyScore } from '../../../api/consistencyApi.js';
import Card from '../../../design-system/Card.jsx';
import Badge from '../../../design-system/Badge.jsx';
import Skeleton from '../../../design-system/Skeleton.jsx';

const PRESENCE_WINDOW = 60;
const SESSION_SECS = 3600;

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

function pad(n) { return String(n).padStart(2, '0'); }

function CircleTimer({ remaining, total, phase }) {
  const R = 110;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, remaining / total);
  const dash = C * pct;
  const color =
    phase === 'presence' ? 'var(--warning)' :
    phase === 'passed'   ? 'var(--accent)' :
    phase === 'failed'   ? 'var(--danger)' :
    phase === 'active'   ? 'var(--accent)' : 'var(--border)';
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: 260, height: 260 }}>
      <svg width="260" height="260" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="130" cy="130" r={R} fill="none" stroke="var(--card-2)" strokeWidth="12" />
        <circle cx="130" cy="130" r={R} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-5xl font-black text-white tabular-nums">
          {pad(mins)}:{pad(secs)}
        </span>
        {phase === 'active'   && <span className="text-xs text-[var(--text-3)] mt-1 uppercase tracking-widest">remaining</span>}
        {phase === 'presence' && <span className="text-xs text-[var(--warning)] mt-1 uppercase tracking-widest animate-pulse">confirm!</span>}
        {phase === 'passed'   && <span className="text-xs text-[var(--accent)] mt-1 uppercase tracking-widest">complete ✓</span>}
        {phase === 'failed'   && <span className="text-xs text-[var(--danger)] mt-1 uppercase tracking-widest">failed ✗</span>}
      </div>
    </div>
  );
}

function SessionBlock({ session, onStart, onConfirm, onFail }) {
  const [phase,          setPhase]       = useState('idle');
  const [remaining,      setRemaining]   = useState(SESSION_SECS);
  const [presenceRem,    setPresenceRem] = useState(PRESENCE_WINDOW);
  const timerRef    = useRef(null);
  const presenceRef = useRef(null);
  const alarmFired  = useRef(false);

  useEffect(() => {
    if (!session) { setPhase('idle'); setRemaining(SESSION_SECS); return; }
    if (session.status === 'passed') { setPhase('passed'); return; }
    if (session.status === 'failed') { setPhase('failed'); return; }
    if (session.status === 'active') {
      const elapsed = Math.floor((Date.now() - new Date(session.started_at + 'Z').getTime()) / 1000);
      const rem = Math.max(0, SESSION_SECS - elapsed);
      setRemaining(rem);
      setPhase(rem > 0 ? 'active' : 'presence');
    }
  }, [session]);

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
    <div className="flex flex-col items-center gap-5">
      <CircleTimer
        remaining={phase === 'presence' ? presenceRem : remaining}
        total={phase === 'presence' ? PRESENCE_WINDOW : SESSION_SECS}
        phase={phase}
      />

      {phase === 'idle' && (
        <button onClick={() => { alarmFired.current = false; onStart(); }}
          className="w-full py-4 bg-[var(--accent)] hover:opacity-90 text-black font-black rounded-2xl text-lg transition-colors shadow-lg shadow-emerald-500/20">
          🧘 Begin Meditation
        </button>
      )}
      {phase === 'active' && (
        <Card elevated className="w-full text-center">
          <p className="text-sm text-[var(--text-2)]">
            Keep your device nearby. The alarm will sound when done.
          </p>
          <p className="text-sm text-[var(--warning)] font-bold mt-1">
            You have 1 minute to confirm presence.
          </p>
        </Card>
      )}
      {phase === 'presence' && (
        <button
          onClick={() => { clearInterval(presenceRef.current); onConfirm(session); setPhase('passed'); }}
          className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl text-xl transition-all animate-pulse shadow-lg shadow-yellow-500/30">
          ✋ I'm Here — {presenceRem}s
        </button>
      )}
      {phase === 'passed' && (
        <Card className="w-full border border-[var(--accent-dim)] text-center py-5">
          <div className="text-[var(--accent)] text-2xl font-black mb-1">✓ Done</div>
          <div className="text-[var(--text-2)] text-sm">Session logged</div>
        </Card>
      )}
      {phase === 'failed' && (
        <div className="flex flex-col gap-3 w-full">
          <Card className="w-full border border-red-900 text-center">
            <div className="text-[var(--danger)] text-sm">Presence not confirmed in time.</div>
          </Card>
          <button
            onClick={() => { setPhase('idle'); setRemaining(SESSION_SECS); alarmFired.current = false; }}
            className="w-full py-3 bg-[var(--card-2)] hover:bg-[var(--border)] text-white font-medium rounded-2xl transition-colors">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

export default function MeditationPage() {
  const [data,    setData]    = useState(null);
  const [score,   setScore]   = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return Promise.allSettled([getTodaySession(), getConsistencyScore()])
      .then(([s, c]) => {
        if (s.status === 'fulfilled') setData(s.value.data);
        if (c.status === 'fulfilled') setScore(c.value.data);
      });
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function handleStart() {
    try { await startSession(null); await load(); } catch (e) { console.error(e); }
  }
  async function handleConfirm(session) {
    try { await confirmPresence(session.id); await load(); } catch {}
  }
  async function handleFail(session) {
    try { await failSession(session.id); await load(); } catch {}
  }

  const sessionStatus = data?.session?.status;
  const badgeVariant = sessionStatus === 'passed' ? 'success' : sessionStatus === 'failed' ? 'danger' : sessionStatus === 'active' ? 'warning' : 'neutral';
  const badgeLabel = sessionStatus === 'passed' ? 'Complete ✓' : sessionStatus === 'failed' ? 'Failed' : sessionStatus === 'active' ? 'In Progress' : 'Pending';

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Meditation</h1>
        {data?.session && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
      </div>

      {loading ? (
        <>
          <Skeleton className="h-64 w-full rounded-full mx-auto" style={{ maxWidth: 264 }} />
          <Skeleton className="h-14 w-full" />
        </>
      ) : (
        <SessionBlock
          session={data?.session}
          onStart={handleStart}
          onConfirm={handleConfirm}
          onFail={handleFail}
        />
      )}

      {/* Score row */}
      {score && (
        <Card className="flex justify-around text-center">
          <div>
            <div className="text-2xl font-black text-[var(--accent)]">{score.consistency}%</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Consistency</div>
          </div>
          <div className="w-px bg-[var(--border)]" />
          <div>
            <div className="text-2xl font-black text-blue-400">{score.pertinence}%</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Pertinence</div>
          </div>
          <div className="w-px bg-[var(--border)]" />
          <div>
            <div className="text-2xl font-black text-purple-400">{score.breakdown?.days_trained ?? '—'}</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">Days trained</div>
          </div>
        </Card>
      )}

      {/* Three pillars info */}
      <Card elevated>
        <div className="text-xs text-[var(--text-3)] uppercase tracking-wider font-semibold mb-3">The Three Pillars</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: '💪', label: 'Train',    color: 'text-[var(--accent)]', sub: '1h morning' },
            { icon: '🧘', label: 'Meditate', color: 'text-purple-400',      sub: '1h morning' },
            { icon: '🤸', label: 'Stretch',  color: 'text-blue-400',        sub: '30min before bed' },
          ].map(p => (
            <div key={p.label} className="bg-[var(--card)] rounded-xl p-3">
              <div className="text-xl">{p.icon}</div>
              <div className={`text-xs font-bold mt-1 ${p.color}`}>{p.label}</div>
              <div className="text-[10px] text-[var(--text-3)] mt-0.5">{p.sub}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="h-2" />
    </div>
  );
}
