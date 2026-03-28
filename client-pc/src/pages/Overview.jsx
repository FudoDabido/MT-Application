import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import StatCard from '../components/StatCard.jsx';
import {
  getProfileStats, getUniversalScores, getDailyScores, getMonthlyReport,
  getBandSummary, getTodayPresence, getTodayTraining, getTodaySession, getTodayStretch,
} from '../api/index.js';
import { Clock, Dumbbell, Brain, Zap, Heart, Droplets, Activity, Footprints, Moon, Wifi } from 'lucide-react';

function fmtMins(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function timeAgo(isoStr) {
  if (!isoStr) return 'Never';
  const d = Math.floor((Date.now() - new Date(isoStr + (isoStr.endsWith('Z') ? '' : 'Z')).getTime()) / 60000);
  if (d < 1) return 'Just now';
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d / 60)}h ago`;
  return `${Math.floor(d / 1440)}d ago`;
}

function ActivityRow({ icon, label, status, href }) {
  const colors = { done: 'text-emerald-400 bg-emerald-900/30', pending: 'text-yellow-400 bg-yellow-900/20', missed: 'text-red-400 bg-red-900/20', late: 'text-orange-400 bg-orange-900/20' };
  const labels = { done: 'Done ✓', pending: 'Pending', missed: 'Missed', late: 'Late' };
  const s = status || 'pending';
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0 hover:opacity-80 transition-opacity">
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors[s]}`}>{labels[s]}</span>
    </a>
  );
}

function Heatmap({ scores }) {
  if (!scores) return <div className="h-24 bg-[var(--card-2)] rounded-xl animate-pulse" />;
  return (
    <div className="grid grid-cols-7 gap-1">
      {['S','M','T','W','T','F','S'].map(d => (
        <div key={d} className="text-center text-[10px] text-[var(--text-3)] font-medium pb-1">{d}</div>
      ))}
      {scores.map((d, i) => {
        const v = d.score || 0;
        const opacity = v === 0 ? 'opacity-20' : v < 40 ? 'opacity-40' : v < 70 ? 'opacity-70' : 'opacity-100';
        return (
          <div key={i} title={`${d.date}: ${v}%${d.has_pr ? ' 🏆 PR' : ''}`}
            className={`aspect-square rounded-md ${opacity} cursor-default transition-opacity`}
            style={{ background: v === 0 ? 'var(--border)' : `hsl(${v * 1.5}, 60%, 40%)` }}>
            {d.has_pr && <div className="w-full h-full flex items-center justify-center text-[8px]">★</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const [scores,   setScores]   = useState(null);
  const [stats,    setStats]    = useState(null);
  const [heatmap,  setHeatmap]  = useState(null);
  const [monthly,  setMonthly]  = useState(null);
  const [band,     setBand]     = useState(null);
  const [today,    setToday]    = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const ym = new Date().toISOString().slice(0, 7);
    Promise.allSettled([
      getUniversalScores(), getProfileStats(), getDailyScores(ym), getMonthlyReport(ym),
      getBandSummary(), getTodayPresence(), getTodayTraining(), getTodaySession(), getTodayStretch(),
    ]).then(([sc, st, hm, mo, ba, pr, tr, me, stc]) => {
      if (sc.status === 'fulfilled') setScores(sc.value.data);
      if (st.status === 'fulfilled') setStats(st.value.data);
      if (hm.status === 'fulfilled') setHeatmap(hm.value.data);
      if (mo.status === 'fulfilled') setMonthly(mo.value.data);
      if (ba.status === 'fulfilled') setBand(ba.value.data);
      const t = {};
      if (pr.status === 'fulfilled') t.presence = pr.value.data;
      if (tr.status === 'fulfilled') t.training  = tr.value.data;
      if (me.status === 'fulfilled') t.meditation= me.value.data;
      if (stc.status === 'fulfilled') t.stretch  = stc.value.data;
      setToday(t);
      setLoading(false);
    });
  }, []);

  // Derive today's activity statuses
  function presenceStatus() {
    const r = today.presence?.record;
    if (!r) return 'pending';
    if (r.status === 'passed') return r.late_wakeup ? 'late' : 'done';
    return 'missed';
  }
  function trainingStatus() {
    const c = today.training?.checkin;
    if (!c) return 'pending';
    if (c.status === 'completed') return 'done';
    if (c.status === 'active') return 'late';
    return 'pending';
  }
  function meditationStatus() {
    const s = today.meditation?.session;
    if (!s) return 'pending';
    if (s.status === 'completed') return 'done';
    if (s.status === 'failed') return 'missed';
    return 'pending';
  }
  function stretchStatus() {
    const c = today.stretch?.checkin;
    if (!c) return 'pending';
    if (c.status === 'completed') return 'done';
    if (c.status === 'failed') return 'missed';
    return 'pending';
  }

  const scoreItems = scores ? [
    { label: 'On-Time Ratio',      value: scores.on_time_ratio?.score,       trend: scores.on_time_ratio?.trend,      color: 'var(--accent)' },
    { label: 'Workout Completion', value: scores.workout_completion?.score,   trend: scores.workout_completion?.trend, color: '#60a5fa' },
    { label: 'Mental / Body',      value: scores.mental_body?.score,          trend: scores.mental_body?.trend,        color: '#a78bfa' },
    { label: 'Consistency',        value: scores.consistency?.score,          trend: scores.consistency?.trend,        color: '#fb923c' },
  ] : [];

  return (
    <div className="p-6 flex flex-col gap-6 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Overview</h1>
          <p className="text-[var(--text-3)] text-sm mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--text-3)]">Program day</div>
          <div className="text-2xl font-black text-[var(--accent)]">{stats?.program_day ?? '—'}<span className="text-[var(--text-3)] text-sm font-normal">/60</span></div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Col 1 — Profile + Today */}
        <div className="col-span-3 flex flex-col gap-4">
          {/* Profile */}
          <div className="bg-[var(--card)] rounded-2xl p-5 flex flex-col items-center gap-3 border border-[var(--border)]">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-xl font-black text-[var(--accent)]">
              {user?.photo_path
                ? <img src={`/uploads/${user.photo_path}`} className="w-16 h-16 rounded-full object-cover" alt="" />
                : (user?.name || 'MT').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div className="text-center">
              <div className="font-bold text-white">{user?.name}</div>
              <div className="text-xs text-[var(--text-3)]">@{user?.username}</div>
            </div>
            <div className="w-full grid grid-cols-2 gap-2 mt-1">
              <div className="bg-[var(--card-2)] rounded-xl p-2.5 text-center">
                <div className="text-lg font-black text-[var(--accent)]">{stats?.sessions ?? '—'}</div>
                <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">Sessions</div>
              </div>
              <div className="bg-[var(--card-2)] rounded-xl p-2.5 text-center">
                <div className="text-lg font-black text-white">{stats?.program_day ?? '—'}</div>
                <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">Day</div>
              </div>
            </div>
          </div>

          {/* Today's Activities */}
          <div className="bg-[var(--card)] rounded-2xl p-4 border border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Today</div>
            <ActivityRow icon="⏰" label="Presence"  status={presenceStatus()}  href="/presence" />
            <ActivityRow icon="💪" label="Training"  status={trainingStatus()}  href="/training" />
            <ActivityRow icon="🧘" label="Meditation" status={meditationStatus()} href="/meditate" />
            <ActivityRow icon="🤸" label="Stretching" status={stretchStatus()}  href="/stretch" />
          </div>
        </div>

        {/* Col 2 — Scores + Heatmap + Monthly */}
        <div className="col-span-6 flex flex-col gap-4">
          {/* Universal Scores */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-4">Universal Scores</div>
            <div className="grid grid-cols-2 gap-3">
              {loading ? Array(4).fill(0).map((_,i) => (
                <div key={i} className="h-20 bg-[var(--card-2)] rounded-xl animate-pulse" />
              )) : scoreItems.map((s, i) => (
                <StatCard key={i} label={s.label} value={s.value != null ? `${s.value}%` : '—'}
                  trend={s.trend} color={s.color} />
              ))}
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-4">30-Day Activity</div>
            <Heatmap scores={heatmap} />
          </div>

          {/* Monthly Report */}
          {monthly && (
            <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
              <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-4">This Month</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Sessions',   value: monthly.sessions ?? '—' },
                  { label: 'New PRs',    value: monthly.new_prs ?? '—' },
                  { label: 'Streak',     value: monthly.longest_streak != null ? `${monthly.longest_streak}d` : '—' },
                  { label: 'Volume (kg)',value: monthly.total_volume_kg != null ? Math.round(monthly.total_volume_kg).toLocaleString() : '—' },
                  { label: 'Wt. Change', value: monthly.weight_change != null ? `${monthly.weight_change > 0 ? '+' : ''}${monthly.weight_change}kg` : '—' },
                ].map((m, i) => (
                  <div key={i} className="bg-[var(--card-2)] rounded-xl p-3">
                    <div className="text-lg font-black text-white">{m.value}</div>
                    <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Col 3 — Health Snapshot */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-4">Health Snapshot</div>
            {!band?.has_data ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Wifi className="w-8 h-8 text-[var(--text-3)]" />
                <p className="text-sm text-[var(--text-3)]">No band data yet</p>
                <a href="/pc/health" className="text-xs text-[var(--accent)] hover:underline">Import data →</a>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {[
                  { icon: <Heart className="w-4 h-4 text-red-400" />,        label: 'Heart Rate',  value: band.latest_hr    ? `${band.latest_hr.bpm} bpm`      : '—', sub: band.latest_hr ? timeAgo(band.latest_hr.recorded_at) : '' },
                  { icon: <Droplets className="w-4 h-4 text-blue-400" />,    label: 'SpO₂',        value: band.latest_spo2  ? `${band.latest_spo2.spo2_pct}%`  : '—', sub: band.latest_spo2 ? timeAgo(band.latest_spo2.recorded_at) : '' },
                  { icon: <Activity className="w-4 h-4 text-yellow-400" />,  label: 'Stress',      value: band.latest_stress ? `${band.latest_stress.stress_score}` : '—', sub: band.latest_stress?.hrv_ms ? `HRV ${band.latest_stress.hrv_ms}ms` : '' },
                  { icon: <Moon className="w-4 h-4 text-purple-400" />,      label: 'Sleep',       value: band.latest_sleep ? fmtMins(band.latest_sleep.total_mins) : '—', sub: band.latest_sleep?.quality_score ? `Quality ${band.latest_sleep.quality_score}%` : '' },
                  { icon: <Footprints className="w-4 h-4 text-emerald-400" />,label:'Steps Today',  value: band.today_activity ? band.today_activity.steps?.toLocaleString() : '—', sub: band.today_activity?.calories_kcal ? `${Math.round(band.today_activity.calories_kcal)} kcal` : '' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                    {r.icon}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wide">{r.label}</div>
                      <div className="text-sm font-bold text-white">{r.value}</div>
                    </div>
                    {r.sub && <div className="text-[10px] text-[var(--text-3)] shrink-0">{r.sub}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last Sync */}
          {band?.last_synced && (
            <div className="bg-[var(--card)] rounded-2xl p-4 border border-[var(--border)]">
              <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Last Sync</div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between"><span className="text-[var(--text-3)]">Device</span><span className="text-white">{band.last_synced.device_id || '—'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-3)]">Battery</span><span className="text-white">{band.last_synced.battery_pct != null ? `${band.last_synced.battery_pct}%` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-3)]">When</span><span className="text-white">{timeAgo(band.last_synced.synced_at)}</span></div>
              </div>
            </div>
          )}

          {/* VO2 Max */}
          {band?.latest_vo2max && (
            <div className="bg-[var(--card)] rounded-2xl p-4 border border-[var(--border)]">
              <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">VO₂ Max</div>
              <div className="text-3xl font-black text-[var(--accent)]">{band.latest_vo2max.vo2_max?.toFixed(1)}</div>
              <div className="text-xs text-[var(--text-3)] mt-1">ml/kg/min · {band.latest_vo2max.date}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
