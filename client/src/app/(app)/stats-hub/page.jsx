'use client';
import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Footprints, Dumbbell, AlertCircle } from 'lucide-react';
import Card from '../../../design-system/Card.jsx';
import Progress from '../../../design-system/Progress.jsx';
import Badge from '../../../design-system/Badge.jsx';
import { getRecords } from '../../../api/recordsApi.js';
import { getPresenceStats } from '../../../api/wakePresenceApi.js';
import { getTrainingStats } from '../../../api/trainingCheckinApi.js';
import { getStretchStats } from '../../../api/stretchCheckinApi.js';
import { getUniversalScores, getRepsStats, getRunningStats } from '../../../api/usersApi.js';

const TABS = [
  { key: 'discipline', label: 'Discipline', Icon: Target     },
  { key: 'records',    label: 'Records',    Icon: TrendingUp },
  { key: 'running',    label: 'Running',    Icon: Footprints },
  { key: 'reps',       label: 'Reps',       Icon: Dumbbell   },
];

function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

function secsToStr(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatRow({ label, value, sub, accent }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="text-sm text-[var(--text-2)]">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-bold ${accent ? 'text-[var(--accent)]' : 'text-white'}`}>{value}</span>
        {sub && <p className="text-[10px] text-[var(--text-3)]">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Discipline Tab ───────────────────────────────────────────────────────────
function DisciplineTab() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getPresenceStats(),
      getTrainingStats(),
      getStretchStats(),
      getUniversalScores(),
    ]).then(([w, tr, st, sc]) => {
      setData({
        wake:    w.status  === 'fulfilled' ? w.value.data  : null,
        train:   tr.status === 'fulfilled' ? tr.value.data : null,
        stretch: st.status === 'fulfilled' ? st.value.data : null,
        scores:  sc.status === 'fulfilled' ? sc.value.data : null,
      });
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-48 bg-[var(--card)] rounded-2xl animate-pulse" />;

  const { wake, train, stretch, scores } = data || {};
  const onTimePct  = scores?.on_time?.score ?? 0;
  const workoutPct = scores?.workout_completion?.score ?? 0;
  const mentalPct  = scores?.mental_body?.score ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Overall scores */}
      <Card>
        <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Discipline Scores</p>
        <div className="flex flex-col gap-3">
          {[
            { label: 'On-Time Ratio',       val: onTimePct  },
            { label: 'Workout Completion',  val: workoutPct },
            { label: 'Mental / Body Score', val: mentalPct  },
          ].map(({ label, val }) => (
            <div key={label}>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-[var(--text-2)]">{label}</span>
                <span className="text-sm font-bold text-[var(--accent)]">{val}%</span>
              </div>
              <Progress value={val} />
            </div>
          ))}
        </div>
      </Card>

      {/* Wake stats */}
      {wake && (
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">⏰ Wake Up</p>
          <StatRow label="On time"    value={wake.passed}               />
          <StatRow label="Late"       value={wake.failed}  accent={wake.failed > 0} />
          <StatRow label="Streak"     value={`${wake.streak} days`}     />
          <StatRow label="Best streak"value={`${wake.best_streak} days`} />
          <StatRow label="Rate"       value={`${pct(wake.passed, wake.total)}%`} accent />
        </Card>
      )}

      {/* Training stats */}
      {train && (
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">💪 Training</p>
          <StatRow label="Completed"   value={train.passed}                />
          <StatRow label="Failed/Missed" value={train.failed} accent={train.failed > 0} />
          <StatRow label="Streak"      value={`${train.streak} days`}      />
          <StatRow label="Best streak" value={`${train.best_streak} days`} />
          <StatRow label="Success rate" value={`${pct(train.passed, train.total)}%`} accent />
        </Card>
      )}

      {/* Stretch stats */}
      {stretch && (
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">🤸 Stretch</p>
          <StatRow label="Completed"   value={stretch.passed}                 />
          <StatRow label="Missed"      value={stretch.failed} accent={stretch.failed > 0} />
          <StatRow label="Streak"      value={`${stretch.streak} days`}       />
          <StatRow label="Best streak" value={`${stretch.best_streak} days`}  />
          <StatRow label="Success rate" value={`${pct(stretch.passed, stretch.total)}%`} accent />
        </Card>
      )}
    </div>
  );
}

// ─── Records Tab ──────────────────────────────────────────────────────────────
function RecordsTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    getRecords()
      .then(r => setRecords(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...new Set(records.map(r => r.category))];
  const filtered = filter === 'all' ? records : records.filter(r => r.category === filter);

  if (loading) return <div className="h-48 bg-[var(--card)] rounded-2xl animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === c ? 'bg-[var(--accent)] text-black' : 'bg-[var(--card)] text-[var(--text-2)]'
            }`}
          >
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center py-8 gap-2 text-center">
          <AlertCircle className="w-8 h-8 text-[var(--text-3)]" />
          <p className="text-[var(--text-2)] text-sm">No personal records yet.</p>
          <p className="text-[var(--text-3)] text-xs">Log workouts to set records.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(r => (
            <Card key={r.id} elevated>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.exercise_name}</p>
                  <p className="text-[10px] text-[var(--text-3)] uppercase">{r.category}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {r.best_reps   != null && <Badge variant="success">🏆 {r.best_reps} reps</Badge>}
                  {r.best_weight_kg != null && <Badge variant="neutral">⚖️ {r.best_weight_kg}kg</Badge>}
                  {r.best_distance_km != null && <Badge variant="neutral">📏 {r.best_distance_km}km</Badge>}
                  {r.best_duration_secs != null && <Badge variant="neutral">⏱ {secsToStr(r.best_duration_secs)}</Badge>}
                </div>
              </div>
              {r.achieved_at && (
                <p className="text-[10px] text-[var(--text-3)] mt-1">
                  Set on {r.achieved_at.split('T')[0] || r.achieved_at.split(' ')[0]}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Running Tab ──────────────────────────────────────────────────────────────
function RunningTab() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRunningStats()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-48 bg-[var(--card)] rounded-2xl animate-pulse" />;

  if (!data || data.total_runs === 0) {
    return (
      <Card className="flex flex-col items-center py-8 gap-2 text-center">
        <Footprints className="w-8 h-8 text-[var(--text-3)]" />
        <p className="text-[var(--text-2)] text-sm">No runs logged yet.</p>
        <p className="text-[var(--text-3)] text-xs">Use Chess Board to log your runs.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total Runs',   value: data.total_runs },
          { label: 'Total km',     value: `${data.total_distance_km} km` },
          { label: 'Best Run',     value: `${data.best_run_km} km` },
          { label: 'Avg Pace',     value: data.avg_pace_min_per_km ? `${data.avg_pace_min_per_km} min/km` : '—' },
          { label: 'Total Time',   value: secsToStr(data.total_duration_secs) },
        ].map(({ label, value }) => (
          <Card key={label} elevated className="flex flex-col items-center py-3 gap-1">
            <span className="text-lg font-black text-[var(--accent)]">{value}</span>
            <span className="text-[10px] text-[var(--text-3)] text-center">{label}</span>
          </Card>
        ))}
      </div>

      {/* Monthly breakdown */}
      {data.monthly_breakdown?.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Monthly</p>
          {data.monthly_breakdown.map(m => (
            <div key={m.month} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <span className="text-sm text-[var(--text-2)]">{m.month}</span>
              <div className="flex gap-3 text-right">
                <span className="text-xs text-[var(--text-3)]">{m.runs} runs</span>
                <span className="text-sm font-bold text-white">{m.distance ? m.distance.toFixed(1) : 0} km</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Recent runs */}
      {data.recent_runs?.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Recent Runs</p>
          {data.recent_runs.slice(0, 10).map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <span className="text-xs text-[var(--text-3)]">{(r.logged_at || '').split('T')[0]}</span>
              <div className="flex gap-3">
                <span className="text-sm font-bold text-white">{r.distance_km} km</span>
                {r.duration_secs && <span className="text-xs text-[var(--text-3)]">{secsToStr(r.duration_secs)}</span>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Reps Tab ─────────────────────────────────────────────────────────────────
function RepsTab() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getRepsStats()
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? data.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : data;

  if (loading) return <div className="h-48 bg-[var(--card)] rounded-2xl animate-pulse" />;

  if (data.length === 0) {
    return (
      <Card className="flex flex-col items-center py-8 gap-2 text-center">
        <Dumbbell className="w-8 h-8 text-[var(--text-3)]" />
        <p className="text-[var(--text-2)] text-sm">No reps tracked yet.</p>
        <p className="text-[var(--text-3)] text-xs">Complete training sessions to see rep stats.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search exercise…"
        className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white"
      />

      {filtered.map(ex => (
        <Card key={ex.name}>
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-bold text-white">{ex.name}</p>
            {ex.max_weight && (
              <Badge variant="neutral">⚖️ max {ex.max_weight}kg</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <StatRow label="All-time reps" value={ex.total_reps?.toLocaleString() || 0} accent />
            <StatRow label="Total sets"    value={ex.total_sets?.toLocaleString() || 0}  />
            <StatRow label="Best day"      value={ex.best_day || 0}                       />
            <StatRow label="Best month"    value={ex.best_month || 0}                     />
            <StatRow label="Best year"     value={ex.best_year || 0}                      />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Stats Hub Page ──────────────────────────────────────────────────────
export default function StatsHubPage() {
  const [activeTab, setActiveTab] = useState('discipline');

  return (
    <div className="flex flex-col" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {/* Header */}
      <div className="px-4 mb-4">
        <h1 className="text-2xl font-black text-white">Stats Hub</h1>
        <p className="text-[var(--text-3)] text-sm">Your full performance breakdown</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 mb-4 overflow-x-auto pb-1">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === key
                ? 'bg-[var(--accent)] text-black'
                : 'bg-[var(--card)] text-[var(--text-2)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pb-6">
        {activeTab === 'discipline' && <DisciplineTab />}
        {activeTab === 'records'    && <RecordsTab />}
        {activeTab === 'running'    && <RunningTab />}
        {activeTab === 'reps'       && <RepsTab />}
      </div>
    </div>
  );
}
