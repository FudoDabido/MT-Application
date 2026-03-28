import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import BarChart from '../components/charts/BarChart.jsx';
import {
  getProfileStats, getExerciseProgress, getMuscleVolume, getWorkoutBreakdown,
  getProgramGrid, getProgramStatus, getLogs,
} from '../api/index.js';

const SLOT_ICONS = { push: '💪', pull: '🔄', legs: '🦵', core: '⚡' };
const STATUS_COLOR = { completed: '#34d399', missed: '#f87171', today: '#fbbf24', future: '#1a1a1a' };

function ProgramGrid({ grid }) {
  if (!grid?.length) return <div className="text-sm text-[var(--text-3)] text-center py-4">No program active</div>;
  return (
    <div className="grid grid-cols-10 gap-1">
      {grid.map(d => (
        <div key={d.day}
          className="aspect-square rounded flex items-center justify-center text-[10px] font-bold cursor-default border"
          style={{ background: STATUS_COLOR[d.status] || '#1a1a1a', borderColor: d.status === 'today' ? '#fbbf24' : 'transparent', color: d.status === 'future' ? '#4b5563' : '#fff' }}
          title={`Day ${d.day} · ${d.date} · ${d.status}`}>
          {d.status === 'completed' ? '✓' : d.status === 'missed' ? '✗' : d.day}
        </div>
      ))}
    </div>
  );
}

function LogsTable({ logs }) {
  if (!logs?.length) return <div className="text-sm text-[var(--text-3)] text-center py-8">No sessions logged yet</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {['Date','Exercise','Reps','Sets','Weight','Duration'].map(h => (
              <th key={h} className="py-2 px-3 text-left text-xs text-[var(--text-3)] font-semibold uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((l, i) => (
            <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--card-2)] transition-colors">
              <td className="py-2.5 px-3 text-[var(--text-2)]">{l.logged_at ? new Date(l.logged_at).toLocaleDateString() : '—'}</td>
              <td className="py-2.5 px-3 text-white font-medium">{l.exercise_name || '—'}</td>
              <td className="py-2.5 px-3 text-[var(--accent)]">{l.reps_done ?? '—'}</td>
              <td className="py-2.5 px-3 text-[var(--text-2)]">{l.sets ?? '—'}</td>
              <td className="py-2.5 px-3 text-[var(--text-2)]">{l.weight_kg ? `${l.weight_kg}kg` : '—'}</td>
              <td className="py-2.5 px-3 text-[var(--text-2)]">{l.duration_secs ? `${Math.round(l.duration_secs / 60)}min` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Training() {
  const [stats,     setStats]     = useState(null);
  const [progress,  setProgress]  = useState([]);
  const [volume,    setVolume]    = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [grid,      setGrid]      = useState([]);
  const [program,   setProgram]   = useState(null);
  const [logs,      setLogs]      = useState([]);
  const [selEx,     setSelEx]     = useState('');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getProfileStats(), getExerciseProgress(), getMuscleVolume(), getWorkoutBreakdown(),
      getProgramGrid(), getProgramStatus(), getLogs({ limit: 30 }),
    ]).then(([st, pr, mv, bk, gr, ps, lg]) => {
      if (st.status === 'fulfilled') setStats(st.value.data);
      if (pr.status === 'fulfilled') { setProgress(pr.value.data || []); }
      if (mv.status === 'fulfilled') setVolume(mv.value.data || []);
      if (bk.status === 'fulfilled') setBreakdown(bk.value.data || []);
      if (gr.status === 'fulfilled') setGrid(gr.value.data?.grid || []);
      if (ps.status === 'fulfilled') setProgram(ps.value.data);
      if (lg.status === 'fulfilled') setLogs(lg.value.data?.logs || lg.value.data || []);
      setLoading(false);
    });
  }, []);

  // Build exercise list from progress data
  const exercises = [...new Set(progress.map(p => p.exercise_name))].filter(Boolean);
  useEffect(() => { if (exercises.length && !selEx) setSelEx(exercises[0]); }, [exercises.length]);

  const exData = selEx
    ? progress.filter(p => p.exercise_name === selEx).map(p => ({
        x: `D${p.program_day}`, y: p.max_weight || p.reps || 0, label: `D${p.program_day}`
      }))
    : [];

  const muscleData = volume.map(v => ({
    label: (v.muscle_group || '').replace(/_/g,' ').slice(0,10),
    value: v.total_volume || v.weekly_volume || 0,
  })).sort((a,b) => b.value - a.value);

  const breakdownData = (breakdown || []).slice(0, 8).map(b => ({
    label: (b.exercise_name || '').slice(0, 10),
    value: b.total_reps || 0,
  }));

  const totalReps = stats?.total_reps || 0;

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-black text-white">Training Analytics</h1>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={stats?.sessions ?? '—'} loading={loading} color="var(--accent)" />
        <StatCard label="Total Reps" value={totalReps ? totalReps.toLocaleString() : '—'} loading={loading} color="#60a5fa" />
        <StatCard label="Program Day" value={stats?.program_day ?? '—'} unit="/60" loading={loading} color="#fb923c" />
        <StatCard label="Workouts Logged" value={stats?.log_stats?.total_workouts ?? '—'} loading={loading} color="#a78bfa" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left — 8 cols */}
        <div className="col-span-8 flex flex-col gap-4">
          {/* Exercise Progression */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-white">Exercise Progression</div>
              <select value={selEx} onChange={e => setSelEx(e.target.value)}
                className="bg-[var(--card-2)] border border-[var(--border)] text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--accent)]">
                {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                {!exercises.length && <option>No data yet</option>}
              </select>
            </div>
            <LineChart data={exData} color="var(--accent)" height={200} unit="" />
          </div>

          {/* Muscle Volume */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-sm font-semibold text-white mb-4">Volume by Muscle Group</div>
            {muscleData.length ? <BarChart data={muscleData} color="var(--accent)" height={160} unit="kg" horizontal /> : (
              <div className="text-sm text-[var(--text-3)] text-center py-8">No volume data yet</div>
            )}
          </div>

          {/* Session History */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-sm font-semibold text-white mb-4">Session History</div>
            <LogsTable logs={logs} />
          </div>
        </div>

        {/* Right — 4 cols */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* 60-Day Grid */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-sm font-semibold text-white mb-4">60-Day Program</div>
            <ProgramGrid grid={grid} />
            <div className="flex gap-3 mt-3 flex-wrap">
              {[['#34d399','Done'],['#f87171','Missed'],['#fbbf24','Today'],['#1a1a1a','Future']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block border border-[#333]" style={{ background: c }} />
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Current Phase */}
          {program?.today_plan && (
            <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
              <div className="text-sm font-semibold text-white mb-3">Current Phase {program.today_plan.phase_number}</div>
              <div className="text-xs text-[var(--text-3)] mb-3">
                Week {program.today_plan.week_in_phase} · Target: <span className="text-[var(--warning)] font-bold">{program.today_plan.target_reps} reps</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {(program.today_plan.exercises || []).map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[var(--card-2)] rounded-xl px-3 py-2">
                    <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                    <div>
                      <div className="text-xs font-medium text-white">{ex.name}</div>
                      <div className="text-[10px] text-[var(--text-3)]">{(ex.muscle_group || '').replace(/_/g,' ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workout Breakdown */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-sm font-semibold text-white mb-4">Top Exercises by Volume</div>
            {breakdownData.length ? <BarChart data={breakdownData} color="#a78bfa" height={150} unit=" reps" /> : (
              <div className="text-sm text-[var(--text-3)] text-center py-6">No data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
