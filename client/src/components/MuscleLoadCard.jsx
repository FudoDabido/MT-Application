'use client';
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { getMuscleRecovery } from '../api/trainingCheckinApi.js';
import Card from '../design-system/Card.jsx';
import Skeleton from '../design-system/Skeleton.jsx';

const BODY_REGIONS = {
  'Upper Body': ['chest', 'back', 'lats', 'shoulders', 'biceps', 'triceps', 'traps', 'forearms'],
  'Core':       ['abs', 'obliques', 'lower_back', 'core'],
  'Lower Body': ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 'adductors', 'abductors'],
};

function muscleLabel(m) {
  const MAP = {
    chest: 'Chest', back: 'Back', lats: 'Lats', shoulders: 'Shoulders',
    biceps: 'Biceps', triceps: 'Triceps', traps: 'Traps', forearms: 'Forearms',
    abs: 'Abs', obliques: 'Obliques', lower_back: 'Lower Back', core: 'Core',
    quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
    hip_flexors: 'Hip Flexors', adductors: 'Adductors', abductors: 'Abductors',
    full_body: 'Full Body', cardio: 'Cardio', neck: 'Neck',
  };
  return MAP[m] || m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function recoveryConfig(pct) {
  if (pct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-900/30', label: 'Ready', dot: '🟢' };
  if (pct >= 50) return { bar: 'bg-yellow-400',  text: 'text-yellow-400',  bg: 'bg-yellow-900/30',  label: 'Recovering', dot: '🟡' };
  return           { bar: 'bg-red-500',     text: 'text-red-400',     bg: 'bg-red-900/30',     label: 'Sore', dot: '🔴' };
}

function fmtHours(h) {
  if (h == null) return 'No recent load';
  if (h === 0) return 'Just loaded';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MuscleLoadCard() {
  const [open, setOpen]       = useState(false);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [openRegion, setOpenRegion] = useState(null);

  useEffect(() => {
    getMuscleRecovery()
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const recovery = data?.recovery || {};

  // Only show muscles that have been trained OR are scheduled tomorrow
  const activeMuscles = Object.entries(recovery).filter(
    ([, d]) => d.load_today > 0 || d.load_last_session > 0 || d.scheduled_tomorrow
  );

  const ready      = activeMuscles.filter(([, d]) => d.recovery_pct >= 80).length;
  const recovering = activeMuscles.filter(([, d]) => d.recovery_pct >= 50 && d.recovery_pct < 80).length;
  const sore       = activeMuscles.filter(([, d]) => d.recovery_pct < 50).length;
  const warnings   = activeMuscles.filter(([, d]) => d.scheduled_tomorrow && d.recovery_pct < 80).length;

  return (
    <Card className={`border transition-all ${warnings > 0 ? 'border-yellow-800' : 'border-[var(--border)]'}`}>
      {/* Header — always visible */}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🫀</span>
          <div className="text-left">
            <div className="text-sm font-bold text-white">Muscle Load</div>
            {loading ? (
              <div className="text-xs text-[var(--text-3)]">Loading...</div>
            ) : activeMuscles.length === 0 ? (
              <div className="text-xs text-[var(--text-3)]">No recent activity</div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                {ready > 0      && <span className="text-[11px] text-emerald-400">🟢 {ready} ready</span>}
                {recovering > 0 && <span className="text-[11px] text-yellow-400">🟡 {recovering} recovering</span>}
                {sore > 0       && <span className="text-[11px] text-red-400">🔴 {sore} sore</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {warnings > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-900/40 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {warnings} tomorrow
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col gap-4">
          {loading ? (
            <>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </>
          ) : activeMuscles.length === 0 ? (
            <div className="text-center py-4">
              <span className="text-3xl">💤</span>
              <p className="text-sm text-[var(--text-2)] mt-2">No muscle load recorded yet.</p>
              <p className="text-xs text-[var(--text-3)] mt-1">Log a training session to see your muscle status.</p>
            </div>
          ) : (
            Object.entries(BODY_REGIONS).map(([region, muscles]) => {
              const regionMuscles = muscles
                .filter(m => recovery[m] && (recovery[m].load_today > 0 || recovery[m].load_last_session > 0 || recovery[m].scheduled_tomorrow))
                .map(m => [m, recovery[m]]);
              if (regionMuscles.length === 0) return null;

              const isOpen = openRegion === region;
              return (
                <div key={region}>
                  <button
                    onClick={() => setOpenRegion(isOpen ? null : region)}
                    className="w-full flex items-center justify-between mb-2"
                  >
                    <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest">{region}</span>
                    <ChevronRight className={`w-3 h-3 text-[var(--text-3)] transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Mini bar summary (always visible within expanded card) */}
                  <div className="flex flex-col gap-2.5">
                    {regionMuscles.map(([muscle, d]) => {
                      const cfg  = recoveryConfig(d.recovery_pct);
                      const pct  = d.recovery_pct;
                      const used = d.load_today > 0 ? Math.round((d.load_today / d.daily_threshold) * 100) : null;

                      return (
                        <div key={muscle}>
                          {/* Row: label + status + bar */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-white w-24 shrink-0">{muscleLabel(muscle)}</span>
                            <div className="flex-1 h-2 rounded-full bg-[var(--card-2)] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold tabular-nums w-8 text-right ${cfg.text}`}>{pct}%</span>
                          </div>

                          {/* Sub-info row */}
                          <div className="flex items-center gap-2 pl-24">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-[var(--text-3)]">
                              {fmtHours(d.hours_since_load)}
                            </span>
                            {used != null && (
                              <span className="text-[10px] text-[var(--text-3)]">
                                · {used}% daily cap used
                              </span>
                            )}
                            {d.scheduled_tomorrow && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto ${
                                pct < 50  ? 'bg-red-900/40 text-red-400' :
                                pct < 80  ? 'bg-yellow-900/40 text-yellow-400' :
                                            'bg-emerald-900/30 text-emerald-400'
                              }`}>
                                {pct < 50 ? '⚠️ ' : pct < 80 ? '⚡ ' : '✅ '}Tomorrow
                              </span>
                            )}
                          </div>

                          {/* Expanded detail: last session + tip */}
                          {isOpen && (
                            <div className={`mt-1.5 ml-0 px-3 py-2 rounded-xl text-[11px] ${cfg.bg} border border-[var(--border)]`}>
                              {d.load_today > 0 && (
                                <p className="text-[var(--text-2)]">
                                  Today's load: <span className="font-bold text-white">{Math.round(d.load_today)}</span> / {d.daily_threshold} units
                                </p>
                              )}
                              {d.load_last_session > 0 && d.load_today === 0 && (
                                <p className="text-[var(--text-2)]">
                                  Last session: <span className="font-bold text-white">{Math.round(d.load_last_session)}</span> units
                                </p>
                              )}
                              {d.hours_since_load != null && (
                                <p className="text-[var(--text-2)] mt-0.5">
                                  Recovery: <span className={`font-bold ${cfg.text}`}>{pct}%</span>
                                  {' '}— needs {d.hours_since_load ? `~${Math.max(0, Math.round((100 - pct) / 100 * 60))}h more` : 'rest'}
                                </p>
                              )}
                              {d.scheduled_tomorrow && pct < 80 && (
                                <p className="text-yellow-300 mt-1 font-medium">
                                  ⚠️ Scheduled tomorrow but not fully recovered — consider swapping this exercise.
                                </p>
                              )}
                              {d.scheduled_tomorrow && pct >= 80 && (
                                <p className="text-emerald-300 mt-1 font-medium">
                                  ✅ Good to go for tomorrow!
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Footer tip */}
          {activeMuscles.length > 0 && (
            <p className="text-[10px] text-[var(--text-3)] text-center pt-2 border-t border-[var(--border)]">
              Tap a region to see detailed load info · Auto-updates when you log sets
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
