import React, { useState, useEffect } from 'react';
import { getRecords, getBadges, getProfileStats, getExerciseProgress } from '../api/index.js';
import { Lock, ChevronDown, ChevronRight } from 'lucide-react';

const BADGE_META = {
  week_1: { label: 'First Week',   day: 7,  icon: '🌱', desc: 'Complete Day 7' },
  week_2: { label: 'Two Weeks',    day: 14, icon: '🌿', desc: 'Complete Day 14' },
  day_30: { label: 'One Month',    day: 30, icon: '🔥', desc: 'Complete Day 30' },
  day_45: { label: '45 Days',      day: 45, icon: '⚡', desc: 'Complete Day 45' },
  day_60: { label: 'Champion',     day: 60, icon: '🏆', desc: 'Complete Day 60' },
};

function MuscleGroup({ group, records, progress }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--card-2)] transition-colors">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-[var(--text-3)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-3)]" />}
          <span className="text-sm font-semibold text-white capitalize">{(group || 'Other').replace(/_/g, ' ')}</span>
          <span className="text-xs text-[var(--text-3)]">({records.length} exercise{records.length !== 1 ? 's' : ''})</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--border)]">
          {records.map((r, i) => {
            const exProgress = progress.filter(p => p.exercise_name === r.exercise_name);
            const lastSession = exProgress[exProgress.length - 1];
            return (
              <div key={i} className={`px-5 py-4 ${i < records.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-white">{r.exercise_name}</div>
                    {r.date && <div className="text-xs text-[var(--text-3)] mt-0.5">Last PR: {r.date}</div>}
                  </div>
                  {lastSession && (
                    <div className="text-xs text-[var(--text-3)] text-right">
                      <div>Day {lastSession.program_day}</div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Best Reps',   value: r.best_reps   != null ? r.best_reps   : r.value,    unit: 'reps', color: 'var(--accent)' },
                    { label: 'Best Weight', value: r.best_weight != null ? r.best_weight : r.weight_kg, unit: 'kg',   color: '#60a5fa' },
                    { label: 'Best Dist.',  value: r.best_dist   != null ? r.best_dist   : null,        unit: 'm',    color: '#fb923c' },
                    { label: 'Best Time',   value: r.best_time   != null ? r.best_time   : null,        unit: 's',    color: '#a78bfa' },
                  ].map((m, j) => (
                    <div key={j} className="bg-[var(--card-2)] rounded-xl p-2.5 text-center">
                      <div className="text-sm font-black" style={{ color: m.value != null ? m.color : 'var(--text-3)' }}>
                        {m.value != null ? m.value : '—'}
                      </div>
                      <div className="text-[10px] text-[var(--text-3)] mt-0.5">{m.unit}</div>
                      <div className="text-[9px] text-[var(--text-3)] uppercase tracking-wider">{m.label.replace('Best ', '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Records() {
  const [records,  setRecords]  = useState([]);
  const [badges,   setBadges]   = useState([]);
  const [stats,    setStats]    = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.allSettled([getRecords(), getBadges(), getProfileStats(), getExerciseProgress()])
      .then(([rc, bd, st, pr]) => {
        if (rc.status === 'fulfilled') setRecords(rc.value.data || []);
        if (bd.status === 'fulfilled') setBadges(bd.value.data || []);
        if (st.status === 'fulfilled') setStats(st.value.data);
        if (pr.status === 'fulfilled') setProgress(pr.value.data || []);
        setLoading(false);
      });
  }, []);

  // Group records by muscle group
  const grouped = {};
  records.forEach(r => {
    const g = r.muscle_group || r.category || 'other';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(r);
  });

  return (
    <div className="p-6 flex flex-col gap-5">
      <h1 className="text-2xl font-black text-white">Records & Achievements</h1>

      <div className="grid grid-cols-12 gap-4">
        {/* Left — 8 cols: Records */}
        <div className="col-span-8 flex flex-col gap-3">
          {loading ? (
            Array(3).fill(0).map((_,i) => <div key={i} className="h-40 bg-[var(--card)] rounded-2xl animate-pulse border border-[var(--border)]" />)
          ) : !records.length ? (
            <div className="bg-[var(--card)] rounded-2xl p-10 border border-[var(--border)] text-center">
              <div className="text-4xl mb-3">🏋️</div>
              <div className="text-white font-bold">No records yet</div>
              <p className="text-sm text-[var(--text-3)] mt-1">Start logging workouts to set personal records</p>
            </div>
          ) : (
            Object.entries(grouped).map(([group, recs]) => (
              <MuscleGroup key={group} group={group} records={recs} progress={progress} />
            ))
          )}
        </div>

        {/* Right — 4 cols: Badges + Stats */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Badges */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-4">Badges</div>
            <div className="flex flex-col gap-3">
              {Object.entries(BADGE_META).map(([key, meta]) => {
                const earned = badges.find(b => b.key === key || b.badge_key === key || b.id === key);
                return (
                  <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${earned ? 'border-emerald-800 bg-emerald-900/20' : 'border-[var(--border)] bg-[var(--card-2)] opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${earned ? 'bg-emerald-900/60' : 'bg-[var(--card)]'}`}>
                      {earned ? meta.icon : <Lock className="w-4 h-4 text-[var(--text-3)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${earned ? 'text-white' : 'text-[var(--text-3)]'}`}>{meta.label}</div>
                      <div className="text-xs text-[var(--text-3)]">{meta.desc}</div>
                    </div>
                    {earned && <span className="text-xs text-emerald-400 font-bold shrink-0">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Achievement Stats */}
          {stats && (
            <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
              <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-4">Lifetime Stats</div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Sessions Trained',  value: stats.sessions ?? '—',                         color: 'var(--accent)' },
                  { label: 'Total Reps',         value: stats.total_reps ? stats.total_reps.toLocaleString() : '—', color: '#60a5fa' },
                  { label: 'Workouts Logged',    value: stats.log_stats?.total_workouts ?? '—',        color: '#fb923c' },
                  { label: 'Program Day',        value: stats.program_day ? `Day ${stats.program_day}/60` : '—', color: '#fbbf24' },
                  { label: 'Records Set',        value: records.length,                                color: '#a78bfa' },
                  { label: 'Badges Earned',      value: `${badges.length}/5`,                          color: '#34d399' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs text-[var(--text-3)]">{s.label}</span>
                    <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
