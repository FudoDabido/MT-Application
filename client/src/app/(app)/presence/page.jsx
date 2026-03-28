'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getTodayPresence, clockInPresence, clockOutPresence } from '../../../api/wakePresenceApi.js';
import Card from '../../../design-system/Card.jsx';
import Badge from '../../../design-system/Badge.jsx';
import Skeleton from '../../../design-system/Skeleton.jsx';

const WINDOW_MINS = 3;

function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function getWindowPhase(wakeTime) {
  if (!wakeTime) return { phase: 'no-schedule' };
  const [wh, wm] = wakeTime.split(':').map(Number);
  const now = new Date();
  const start = new Date(now); start.setHours(wh, wm, 0, 0);
  const end   = new Date(now); end.setHours(wh, wm + WINDOW_MINS, 0, 0);
  if (now < start) return { phase: 'waiting', secsUntil: Math.ceil((start - now) / 1000) };
  if (now <= end)  return { phase: 'open',    secsLeft:  Math.ceil((end - now) / 1000) };
  return { phase: 'late' };
}
function secsUntilNextWake(wakeTime) {
  if (!wakeTime) return null;
  const [wh, wm] = wakeTime.split(':').map(Number);
  const now = new Date();
  const next = new Date(now); next.setHours(wh, wm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return Math.ceil((next - now) / 1000);
}
function fmtCountdown(secs) {
  if (secs == null) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export default function PresencePage() {
  const [loading,     setLoading]     = useState(true);
  const [record,      setRecord]      = useState(null);
  const [wakeTime,    setWakeTime]    = useState(null);
  const [bedTime,     setBedTime]     = useState(null);
  const [startsOn,    setStartsOn]    = useState(null);
  const [windowPhase, setWindowPhase] = useState({});
  const [countdown,   setCountdown]   = useState(null);
  const [busy,        setBusy]        = useState(false);
  const tickRef = useRef(null);

  async function load() {
    try {
      const res = await getTodayPresence();
      setRecord(res.data.record);
      setWakeTime(res.data.wake_time);
      setBedTime(res.data.bed_time);
      setStartsOn(res.data.starts_on || null);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setWindowPhase(getWindowPhase(wakeTime));
      setCountdown(secsUntilNextWake(wakeTime));
    }, 1000);
    setWindowPhase(getWindowPhase(wakeTime));
    setCountdown(secsUntilNextWake(wakeTime));
    return () => clearInterval(tickRef.current);
  }, [wakeTime]);

  async function handleClockIn() {
    setBusy(true);
    try {
      const res = await clockInPresence();
      setRecord(res.data.record);
    } catch (err) {
      if (err.response?.status === 409) await load();
    } finally { setBusy(false); }
  }

  async function handleClockOut() {
    setBusy(true);
    try {
      const res = await clockOutPresence();
      setRecord(res.data.record);
    } catch {} finally { setBusy(false); }
  }

  const clockedIn  = !!record?.clocked_in_at;
  const clockedOut = !!record?.clocked_out_at;
  const isLate     = record?.late_wakeup === 1;

  const countdownColor =
    countdown == null ? 'text-[var(--text-3)]' :
    countdown < 600   ? 'text-[var(--danger)]' :
    countdown < 3600  ? 'text-orange-400' :
    countdown < 10800 ? 'text-[var(--warning)]' : 'text-white';

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Presence</h1>
        {record && (
          <Badge variant={clockedIn ? (isLate ? 'warning' : 'success') : 'neutral'}>
            {clockedIn ? (isLate ? 'Late' : 'Done ✓') : 'Pending'}
          </Badge>
        )}
      </div>

      {loading ? (
        <>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-28 w-full" />
        </>
      ) : startsOn ? (
        <Card className="text-center py-8 flex flex-col items-center gap-3">
          <span className="text-5xl">🗓</span>
          <div className="text-white font-bold">Program starts tomorrow</div>
          <p className="text-sm text-[var(--text-2)]">Presence tracking begins on Day 1 ({startsOn}). Wake time: {wakeTime}</p>
        </Card>
      ) : !wakeTime ? (
        <Card className="text-center py-8 flex flex-col items-center gap-3">
          <span className="text-5xl">⏰</span>
          <div className="text-white font-bold">No active program</div>
          <p className="text-sm text-[var(--text-2)]">Complete program setup to enable presence tracking.</p>
        </Card>
      ) : (
        <>
          {/* Countdown hero */}
          <Card className="flex flex-col items-center py-6 gap-2">
            <div className="text-xs text-[var(--text-3)] uppercase tracking-widest">
              {clockedIn ? 'Next wake-up in' : 'Wake window'}
            </div>
            <div className={`text-6xl font-black tabular-nums leading-none ${countdownColor}`}>
              {fmtCountdown(countdown)}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="text-center">
                <div className="text-xs text-[var(--text-3)] uppercase tracking-widest">Wake</div>
                <div className="text-xl font-black text-white tabular-nums">{wakeTime}</div>
              </div>
              {bedTime && (
                <>
                  <div className="w-px h-8 bg-[var(--border)]" />
                  <div className="text-center">
                    <div className="text-xs text-[var(--text-3)] uppercase tracking-widest">Bed</div>
                    <div className="text-xl font-black text-white tabular-nums">{bedTime}</div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Window open — big CTA */}
          {windowPhase.phase === 'open' && !clockedIn && (
            <button onClick={handleClockIn} disabled={busy}
              className="w-full py-7 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-2xl text-3xl transition-all animate-pulse shadow-2xl shadow-yellow-500/30">
              {busy ? 'Clocking in…' : '✋ CLOCK IN'}
            </button>
          )}

          {/* Today status card */}
          <Card className="flex flex-col gap-4">
            <div className="text-xs text-[var(--text-3)] uppercase tracking-widest font-semibold">Today</div>

            {/* Clock in row */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Wake up</div>
                {clockedIn ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--accent)] font-semibold">
                      Clocked in {fmtTime(record.clocked_in_at)}
                    </span>
                    {isLate && <Badge variant="warning">Late</Badge>}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-3)] mt-0.5">
                    {windowPhase.phase === 'open'
                      ? `Window closes in ${fmtCountdown(windowPhase.secsLeft)}`
                      : windowPhase.phase === 'late'
                      ? 'Missed window — clock in anyway'
                      : `Opens at ${wakeTime}`}
                  </div>
                )}
              </div>
              {!clockedIn && windowPhase.phase !== 'open' && (
                windowPhase.phase === 'late' ? (
                  <button onClick={handleClockIn} disabled={busy}
                    className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
                    {busy ? '…' : 'Clock In (Late)'}
                  </button>
                ) : (
                  <span className="text-xs text-[var(--text-3)] px-3 py-2 bg-[var(--card-2)] rounded-xl">Waiting</span>
                )
              )}
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* Clock out row */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Go to bed</div>
                {clockedOut ? (
                  <div className="text-xs text-blue-400 font-semibold mt-0.5">
                    Clocked out {fmtTime(record.clocked_out_at)}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-3)] mt-0.5">
                    {bedTime ? `Scheduled bedtime ${bedTime}` : 'Tap when going to sleep'}
                  </div>
                )}
              </div>
              {!clockedOut && (
                <button onClick={handleClockOut} disabled={busy}
                  className="px-4 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
                  {busy ? '…' : '🌙 Clock Out'}
                </button>
              )}
            </div>
          </Card>
        </>
      )}

      <div className="h-2" />
    </div>
  );
}
