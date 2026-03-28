'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getTodayPresence, clockInPresence, clockOutPresence } from '../api/wakePresenceApi.js';

const WINDOW_MINS = 3;

function pad(n) { return String(n).padStart(2, '0'); }

function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Returns seconds until wake window or seconds into window (negative = past)
function getWindowPhase(wakeTime) {
  if (!wakeTime) return { phase: 'no-schedule' };
  const [wh, wm] = wakeTime.split(':').map(Number);
  const now        = new Date();
  const windowStart = new Date(now); windowStart.setHours(wh, wm, 0, 0);
  const windowEnd   = new Date(now); windowEnd.setHours(wh, wm + WINDOW_MINS, 0, 0);

  if (now < windowStart) return { phase: 'waiting', secsUntil: Math.ceil((windowStart - now) / 1000) };
  if (now <= windowEnd)  return { phase: 'open',    secsLeft:  Math.ceil((windowEnd - now) / 1000) };
  return { phase: 'late' };
}

// Seconds until tomorrow's wake time (always positive)
function secsUntilNextWake(wakeTime) {
  if (!wakeTime) return null;
  const [wh, wm] = wakeTime.split(':').map(Number);
  const now      = new Date();
  const next     = new Date(now);
  next.setHours(wh, wm, 0, 0);
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
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Tick every second
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
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    setBusy(true);
    try {
      const res = await clockOutPresence();
      setRecord(res.data.record);
    } catch {}
    finally { setBusy(false); }
  }

  if (loading) return <div className="flex justify-center py-20 text-gray-400">Loading…</div>;

  const clockedIn  = !!record?.clocked_in_at;
  const clockedOut = !!record?.clocked_out_at;
  const isLate     = record?.late_wakeup === 1;

  // Countdown urgency colour
  const countdownColor =
    countdown == null   ? 'text-gray-500' :
    countdown < 600     ? 'text-red-400' :
    countdown < 3600    ? 'text-orange-400' :
    countdown < 10800   ? 'text-yellow-400' : 'text-white';

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <h1 className="text-2xl font-black text-white">Presence Tracker</h1>

      {/* No program */}
      {!wakeTime && (
        <div className="bg-gray-900 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">⏰</div>
          <div className="text-white font-bold">No active program</div>
          <div className="text-sm text-gray-500 mt-1">Complete program setup to enable presence tracking.</div>
        </div>
      )}

      {wakeTime && (
        <>
          {/* Next wake countdown — main focus */}
          <div className="bg-gray-900 rounded-2xl p-6 text-center">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              {clockedIn ? 'Next wake-up in' : 'Wake up in'}
            </div>
            <div className={`text-6xl font-black tabular-nums leading-none ${countdownColor}`}>
              {fmtCountdown(countdown)}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="text-center">
                <div className="text-xs text-gray-600 uppercase tracking-widest">Wake time</div>
                <div className="text-lg font-black text-white tabular-nums">{wakeTime}</div>
              </div>
              {bedTime && (
                <>
                  <div className="w-px h-8 bg-gray-800" />
                  <div className="text-center">
                    <div className="text-xs text-gray-600 uppercase tracking-widest">Bedtime</div>
                    <div className="text-lg font-black text-white tabular-nums">{bedTime}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Today's status */}
          <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Today</div>

            {/* Clock In row */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Wake up</div>
                {clockedIn ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-emerald-400 font-semibold">Clocked in {fmtTime(record.clocked_in_at)}</span>
                    {isLate && <span className="text-[10px] bg-orange-900/50 text-orange-400 px-1.5 py-0.5 rounded-full">Late</span>}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {windowPhase.phase === 'open'
                      ? `Window closes in ${fmtCountdown(windowPhase.secsLeft)}`
                      : windowPhase.phase === 'late'
                      ? 'Missed window — clock in anyway'
                      : `Opens at ${wakeTime}`}
                  </div>
                )}
              </div>

              {!clockedIn && (
                windowPhase.phase === 'open' ? (
                  <button onClick={handleClockIn} disabled={busy}
                    className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl text-sm transition-all animate-pulse shadow-lg shadow-yellow-500/30">
                    {busy ? '…' : '✋ Clock In'}
                  </button>
                ) : windowPhase.phase === 'late' ? (
                  <button onClick={handleClockIn} disabled={busy}
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
                    {busy ? '…' : 'Clock In (Late)'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-600 px-3 py-2 bg-gray-800 rounded-xl">Waiting</span>
                )
              )}
            </div>

            <div className="h-px bg-gray-800" />

            {/* Clock Out row */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Go to bed</div>
                {clockedOut ? (
                  <div className="text-xs text-blue-400 font-semibold mt-0.5">
                    Clocked out {fmtTime(record.clocked_out_at)}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {bedTime ? `Scheduled bedtime ${bedTime}` : 'Tap when going to sleep'}
                  </div>
                )}
              </div>

              {!clockedOut && (
                <button onClick={handleClockOut} disabled={busy}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
                  {busy ? '…' : '🌙 Clock Out'}
                </button>
              )}
            </div>

            {/* Sleep duration (if both clocked) */}
            {clockedIn && clockedOut && (() => {
              const inMs  = new Date(record.clocked_in_at  + 'Z').getTime();
              const outMs = new Date(record.clocked_out_at + 'Z').getTime();
              // clock-out could be BEFORE clock-in if they went to bed the previous night
              // calculate duration of this night's sleep: outMs - inMs might be negative
              // More useful: show both times, don't compute duration here
              // Instead show: slept from clocked_out_at (yesterday) to clocked_in_at (this morning)
              // We don't have yesterday's clock-out, so skip duration
              return null;
            })()}
          </div>

          {/* Window open — full-screen CTA */}
          {windowPhase.phase === 'open' && !clockedIn && (
            <button onClick={handleClockIn} disabled={busy}
              className="w-full py-8 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-2xl text-3xl transition-all shadow-2xl shadow-yellow-500/30 animate-pulse">
              {busy ? 'Clocking in…' : '✋ CLOCK IN'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
