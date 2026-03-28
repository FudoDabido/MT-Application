'use client';
import React, { useState, useEffect } from 'react';
import Spinner from '../components/shared/Spinner.jsx';
import {
  getProfileStats, getUniversalScores, getWorkoutBreakdown,
  getExerciseProgress, getMuscleVolume, getMonthlyReport, getBadges, saveStreakReflection,
} from '../api/usersApi.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function fmtDuration(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtKg(kg) {
  if (!kg) return '—';
  if (kg >= 1000) return (kg / 1000).toFixed(1) + 't';
  return kg % 1 === 0 ? String(kg) : kg.toFixed(1);
}
function muscleLabel(m) { return (m || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

// ── Components ────────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{children}</div>;
}

function StatTile({ label, value, icon, color = 'text-white', sub }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-lg">{icon}</div>
      <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 leading-tight">{label}</div>
      {sub && <div className="text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

// C3: ScoreTile with trend arrows
function ScoreTile({ icon, label, scoreObj }) {
  const score = typeof scoreObj === 'object' ? scoreObj?.score : scoreObj;
  const trend = typeof scoreObj === 'object' ? scoreObj?.trend : null;
  const val = score == null ? null : score;
  const color    = val == null ? 'text-gray-600' : val >= 80 ? 'text-emerald-400' : val >= 50 ? 'text-yellow-400' : 'text-red-400';
  const barColor = val == null ? 'bg-gray-700'   : val >= 80 ? 'bg-emerald-500'  : val >= 50 ? 'bg-yellow-500'  : 'bg-red-500';
  const trendNum = trend ? parseInt(trend) : 0;
  const trendColor = trendNum > 0 ? 'text-emerald-400' : trendNum < 0 ? 'text-red-400' : 'text-gray-600';
  const trendArrow = trendNum > 0 ? '↑' : trendNum < 0 ? '↓' : '→';
  return (
    <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs text-gray-400 font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {trend != null && (
            <span className={`text-xs font-semibold ${trendColor}`}>{trendArrow} {trend !== '0' ? trend + '%' : ''}</span>
          )}
          <span className={`text-xl font-black tabular-nums ${color}`}>{val == null ? '—' : `${val}%`}</span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: val == null ? '0%' : `${val}%` }} />
      </div>
    </div>
  );
}

// B4: Monthly report card
function MonthlyReport({ report }) {
  if (!report) return null;
  const ym = report.year_month || '';
  const [y, m] = ym.split('-');
  const monthName = m ? new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : ym;
  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">{monthName}</div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-2xl font-black text-emerald-400">{report.sessions}</div>
          <div className="text-xs text-gray-500 mt-0.5">Sessions</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-yellow-400">{report.new_prs}</div>
          <div className="text-xs text-gray-500 mt-0.5">New PRs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-blue-400">{report.longest_streak}</div>
          <div className="text-xs text-gray-500 mt-0.5">Streak</div>
        </div>
      </div>
      {report.total_volume_kg > 0 && (
        <div className="mt-3 text-center">
          <span className="text-sm text-gray-400">Volume lifted: </span>
          <span className="text-sm font-bold text-white">{fmtKg(report.total_volume_kg)} kg</span>
        </div>
      )}
      {report.weight_change != null && (
        <div className="mt-1 text-center text-xs text-gray-500">
          Weight change: <span className={report.weight_change > 0 ? 'text-red-400' : 'text-emerald-400'}>{report.weight_change > 0 ? '+' : ''}{report.weight_change} kg</span>
        </div>
      )}
    </div>
  );
}

// B2: Muscle volume bars
function MuscleVolume({ muscles }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('volume');
  if (!muscles?.length) return null;
  const maxWeek = Math.max(...muscles.map(m => view === 'volume' ? m.week_volume : m.week_reps), 1);
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
        <SectionTitle>Muscle Volume (This Week)</SectionTitle>
        <span className="text-gray-500 text-lg mb-3">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
            {['volume', 'reps'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${view === v ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
                {v === 'volume' ? 'Volume (kg)' : 'Reps'}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {muscles.map((m, i) => {
              const val = view === 'volume' ? m.week_volume : m.week_reps;
              const pct = Math.round((val / maxWeek) * 100);
              const barClass = i < 2 ? 'bg-emerald-500' : i < 5 ? 'bg-blue-500' : 'bg-gray-600';
              return (
                <div key={m.muscle_group} className="flex items-center gap-2">
                  <div className="text-xs text-gray-400 w-28 shrink-0">{muscleLabel(m.muscle_group)}</div>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 w-12 text-right tabular-nums">
                    {view === 'volume' ? fmtKg(val) : fmtNum(val)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// B1: Per-exercise progression chart (pure SVG)
function ProgressionCharts({ progress }) {
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState(null);
  const [metric, setMetric]   = useState('weight'); // 'weight' | 'reps'

  if (!progress?.exercises?.length) return null;

  useEffect(() => {
    if (progress?.exercises?.length && !selected) setSelected(progress.exercises[0].exercise_type_id);
  }, [progress]);

  const exercise = progress?.exercises?.find(e => e.exercise_type_id === selected);
  const points = exercise?.points || [];
  const hasWeight = points.some(p => p.max_weight > 0);

  function renderChart(pts, key) {
    if (!pts.length) return <p className="text-sm text-gray-600 text-center py-4">No data yet.</p>;
    const vals = pts.map(p => p[key] || 0);
    const maxVal = Math.max(...vals, 1);
    const minVal = Math.min(...vals.filter(v => v > 0), 0);
    const W = 300, H = 100, PAD = 10;
    const xs = pts.map((p, i) => PAD + (i / Math.max(pts.length - 1, 1)) * (W - PAD * 2));
    const ys = vals.map(v => PAD + (1 - (v - minVal) / (maxVal - minVal || 1)) * (H - PAD * 2));
    const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    return (
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 200, height: 100 }}>
          <polyline fill="none" stroke="#10b981" strokeWidth="2" points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} />
          {pts.map((p, i) => (
            <circle key={i} cx={xs[i]} cy={ys[i]} r="3" fill={i === pts.length - 1 ? '#f59e0b' : '#10b981'} />
          ))}
        </svg>
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>Day {pts[0]?.program_day}</span>
          <span className="text-gray-400 font-semibold">{key === 'max_weight' ? `Max: ${Math.max(...vals)}kg` : `Max: ${Math.max(...vals)} reps`}</span>
          <span>Day {pts[pts.length - 1]?.program_day}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
        <SectionTitle>Progression Charts</SectionTitle>
        <span className="text-gray-500 text-lg mb-3">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <div className="flex flex-wrap gap-1 mb-3">
            {progress.exercises.map(ex => (
              <button key={ex.exercise_type_id} onClick={() => setSelected(ex.exercise_type_id)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${selected === ex.exercise_type_id ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {ex.exercise_name}
              </button>
            ))}
          </div>
          {hasWeight && (
            <div className="flex gap-1 mb-3 bg-gray-800 rounded-lg p-1">
              {['weight', 'reps'].map(v => (
                <button key={v} onClick={() => setMetric(v)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${metric === v ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
                  {v === 'weight' ? 'Weight (kg)' : 'Reps'}
                </button>
              ))}
            </div>
          )}
          {renderChart(points, metric === 'weight' && hasWeight ? 'max_weight' : 'max_reps')}
        </div>
      )}
    </div>
  );
}

// C2: Badges
function BadgeSection({ badges }) {
  if (!badges?.length) return null;
  return (
    <div>
      <SectionTitle>Program Badges</SectionTitle>
      <div className="flex gap-2 flex-wrap">
        {badges.map(b => (
          <div key={b.key} className={`flex flex-col items-center p-3 rounded-xl border ${b.earned ? 'bg-gray-900 border-emerald-800' : 'bg-gray-900/50 border-gray-800 opacity-40'}`} style={{ minWidth: 72 }}>
            <span className="text-2xl">{b.icon}</span>
            <span className="text-[10px] text-gray-400 mt-1 text-center leading-tight">{b.label}</span>
            {b.earned_at && <span className="text-[9px] text-gray-600 mt-0.5">{b.earned_at.split(' ')[0]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// C1: Resilience / streak reflection card
function ResilienceCard({ onSaved }) {
  const [text, setText]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await saveStreakReflection(yesterday, text.trim());
      setSaved(true);
      onSaved?.();
    } catch (e) {
      const msg = e?.response?.data?.error || 'Could not save';
      alert(msg);
    } finally { setSaving(false); }
  }

  if (saved) {
    return (
      <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4 text-center">
        <div className="text-emerald-400 font-bold text-sm">Streak preserved ✓*</div>
        <div className="text-xs text-gray-500 mt-1">Reflection saved. Your streak continues.</div>
      </div>
    );
  }

  return (
    <div className="bg-orange-900/20 border border-orange-700 rounded-xl p-4">
      <div className="text-orange-400 font-bold text-sm mb-1">You missed yesterday — preserve your streak?</div>
      <div className="text-xs text-gray-500 mb-3">Write one sentence about why you missed. (Once per 7 days)</div>
      <textarea
        value={text} onChange={e => setText(e.target.value)} maxLength={200} rows={2}
        placeholder="I missed because…"
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none mb-2"
      />
      <button onClick={handleSave} disabled={saving || !text.trim()}
        className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold text-sm rounded-lg transition-colors">
        {saving ? 'Saving…' : 'Preserve Streak →'}
      </button>
    </div>
  );
}

// Workout stats (existing, unchanged)
function WorkoutStats({ breakdown }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('reps');
  const weighted = breakdown?.filter(ex => ex.max_weight > 0) || [];
  const hasWeight = weighted.length > 0;
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
        <SectionTitle>Workout Statistics</SectionTitle>
        <span className="text-gray-500 text-lg mb-3">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          {!breakdown?.length ? (
            <p className="text-sm text-gray-600 text-center py-4">No exercises logged yet.</p>
          ) : (
            <>
              {hasWeight && (
                <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1">
                  {['reps', 'weight'].map(v => (
                    <button key={v} onClick={() => setView(v)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${view === v ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
                      {v === 'reps' ? 'Reps' : 'Weight (kg)'}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-4 gap-1 mb-2">
                <div className="text-[10px] text-gray-600 col-span-1" />
                {['Day', 'Month', 'Year'].map(h => (
                  <div key={h} className="text-[10px] text-gray-500 text-right font-medium">{h}</div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {breakdown.map(ex => {
                  const showWeight = view === 'weight' && ex.max_weight > 0;
                  return (
                    <div key={ex.exercise_name || ex.exercise_type_id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white font-medium truncate max-w-[55%]">{ex.exercise_name}</span>
                        {ex.max_weight > 0 && <span className="text-[10px] text-gray-600">max {ex.max_weight} kg</span>}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <div className="text-[10px] text-gray-600 self-center">{showWeight ? 'kg lifted' : 'reps'}</div>
                        {showWeight ? (
                          <>
                            <div className="text-xs text-blue-400 font-bold tabular-nums text-right">{fmtKg(ex.day_kg)}</div>
                            <div className="text-xs text-blue-400 font-bold tabular-nums text-right">{fmtKg(ex.month_kg)}</div>
                            <div className="text-xs text-blue-400 font-bold tabular-nums text-right">{fmtKg(ex.year_kg)}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-emerald-400 font-bold tabular-nums text-right">{fmtNum(ex.day_reps)}</div>
                            <div className="text-xs text-emerald-400 font-bold tabular-nums text-right">{fmtNum(ex.month_reps)}</div>
                            <div className="text-xs text-emerald-400 font-bold tabular-nums text-right">{fmtNum(ex.year_reps)}</div>
                          </>
                        )}
                      </div>
                      <div className="h-px bg-gray-800" />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const [stats,     setStats]     = useState(null);
  const [scores,    setScores]    = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [progress,  setProgress]  = useState(null);
  const [muscles,   setMuscles]   = useState(null);
  const [report,    setReport]    = useState(null);
  const [badges,    setBadges]    = useState(null);
  const [showResil, setShowResil] = useState(false);
  const [loading,   setLoading]   = useState(true);

  function load() {
    Promise.all([
      getProfileStats(),
      getUniversalScores(),
      getWorkoutBreakdown(),
      getExerciseProgress(),
      getMuscleVolume(),
      getMonthlyReport(),
      getBadges(),
    ]).then(([s, sc, br, pr, mv, rep, bdg]) => {
      setStats(s.data);
      setScores(sc.data);
      setBreakdown(br.data?.exercises);
      setProgress(pr.data);
      setMuscles(mv.data?.muscles);
      setReport(rep.data);
      setBadges(bdg.data?.badges);

      // C1: Check if yesterday was missed — show resilience prompt
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      // We show it if training completion is low and yesterday had no data — server already validated
      // Simple heuristic: show it if scores are present but not perfect
      setShowResil(false); // reset
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Check if resilience should be shown (yesterday's checkin was failed/missed)
  useEffect(() => {
    if (!stats) return;
    // Show resilience if sessions < program_day (missed at least 1 day)
    if (stats.program_day && stats.sessions < stats.program_day - 1) {
      setShowResil(true);
    }
  }, [stats]);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const log = stats?.log_stats;

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <h1 className="text-2xl font-black text-white">Statistics</h1>

      {/* C1: Resilience card */}
      {showResil && <ResilienceCard onSaved={() => { setShowResil(false); load(); }} />}

      {/* B4: Monthly report */}
      {report && (
        <div>
          <SectionTitle>This Month</SectionTitle>
          <MonthlyReport report={report} />
        </div>
      )}

      {/* Training overview */}
      <div>
        <SectionTitle>Training Overview</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="💪" label="Sessions Completed" value={fmtNum(stats?.sessions)}         color="text-emerald-400" />
          <StatTile icon="🔢" label="Total Reps Logged"  value={fmtNum(stats?.total_reps)}       color="text-yellow-400" />
          <StatTile icon="📋" label="Workout Logs"       value={fmtNum(log?.total_workouts)}      color="text-blue-400" />
          <StatTile icon="⏱️" label="Time Trained"       value={fmtDuration(log?.total_duration_secs)} color="text-purple-400" />
        </div>
      </div>

      {/* Program progress */}
      {stats?.program_day && (
        <div>
          <SectionTitle>60-Day Program</SectionTitle>
          <div className="bg-gray-900 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Current Day</span>
              <span className="text-3xl font-black text-emerald-400">{stats.program_day} <span className="text-lg text-gray-600">/ 60</span></span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(stats.program_day / 60) * 100}%` }} />
            </div>
            <div className="text-xs text-gray-600 mt-2 text-right">{Math.round((stats.program_day / 60) * 100)}% complete</div>
          </div>
        </div>
      )}

      {/* C2: Badges */}
      <BadgeSection badges={badges} />

      {/* C3: Discipline scores with trends */}
      <div>
        <SectionTitle>Discipline Scores</SectionTitle>
        <div className="flex flex-col gap-2">
          <ScoreTile icon="⏱"  label="On-Time Ratio"      scoreObj={scores?.on_time} />
          <ScoreTile icon="💪" label="Workout Completion"  scoreObj={scores?.workout_completion} />
          <ScoreTile icon="🧠" label="Mental / Body"       scoreObj={scores?.mental_body} />
          <ScoreTile icon="🔥" label="Consistency"         scoreObj={scores?.consistency} />
        </div>
      </div>

      {/* B2: Muscle volume */}
      <MuscleVolume muscles={muscles} />

      {/* B1: Progression charts */}
      <ProgressionCharts progress={progress} />

      {/* Workout statistics */}
      <WorkoutStats breakdown={breakdown} />
    </div>
  );
}
