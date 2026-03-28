import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import BarChart from '../components/charts/BarChart.jsx';
import DonutChart from '../components/charts/DonutChart.jsx';
import {
  getSleepHistory, getHeartRateHistory, getSpo2History, getStressHistory,
  getActivityHistory, getBandWorkouts, getFitnessMetrics, getBandSyncLog, importBandData,
} from '../api/index.js';
import { Upload, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const TABS = ['Sleep','Heart Rate','Blood & O₂','Activity','Fitness'];

function avg(arr, key) {
  const vals = arr.map(r => Number(r[key])).filter(v => !isNaN(v) && v > 0);
  return vals.length ? Math.round(vals.reduce((a,b) => a+b, 0) / vals.length) : null;
}
function max(arr, key) { return arr.reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0) || null; }
function min(arr, key) { const vals = arr.map(r => Number(r[key])).filter(v => v > 0); return vals.length ? Math.min(...vals) : null; }
function fmtMins(m) { if (!m) return '—'; const h = Math.floor(m/60); return h > 0 ? `${h}h ${m%60}m` : `${m}m`; }
function fmtDate(s) { if (!s) return '—'; return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function fmtDuration(s) { if (!s) return '—'; const m=Math.floor(s/60), h=Math.floor(m/60); return h>0?`${h}h ${m%60}m`:`${m}m`; }

function EmptyState({ tab }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="text-5xl">📡</span>
      <div className="text-white font-bold">No {tab} data yet</div>
      <p className="text-sm text-[var(--text-3)] max-w-xs">Import data from your Xiaomi Band 9 Active using the panel above to see your health analytics.</p>
    </div>
  );
}

function ImportPanel() {
  const [open,    setOpen]    = useState(false);
  const [json,    setJson]    = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');

  async function handleImport() {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = JSON.parse(json);
      const res = await importBandData(data);
      setResult(res.data.imported);
      setJson('');
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Invalid JSON or import failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--card-2)] transition-colors">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-white">Import Band Data</span>
          <span className="text-xs text-[var(--text-3)]">Xiaomi Band 9 Active</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-3)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-3)]" />}
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-3)] mt-3">
            Paste a JSON object with keys: <code className="text-[var(--accent)]">hr_readings, spo2_readings, stress_readings, skin_temp_readings, sleep_sessions, daily_activity, band_workouts, fitness_metrics, sync_meta</code>
          </p>
          <textarea
            value={json} onChange={e => setJson(e.target.value)} rows={6}
            placeholder={'{\n  "sleep_sessions": [...],\n  "hr_readings": [...],\n  ...\n}'}
            className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl p-3 text-xs text-white font-mono resize-y focus:outline-none focus:border-[var(--accent)]"
          />
          {error && <p className="text-[var(--danger)] text-xs">{error}</p>}
          {result && (
            <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-3 text-xs text-emerald-300">
              ✓ Imported: {Object.entries(result).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ') || 'No new records'}
            </div>
          )}
          <button onClick={handleImport} disabled={loading || !json.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-opacity self-start">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? 'Importing…' : 'Import'}
          </button>
        </div>
      )}
    </div>
  );
}

function SleepTab({ data }) {
  if (!data?.length) return <EmptyState tab="sleep" />;
  const avgHours = avg(data, 'total_mins');
  const avgQuality = avg(data, 'quality_score');
  const avgDeep = avg(data, 'deep_mins');
  const avgRem = avg(data, 'rem_mins');
  const avgLight = avg(data.filter(d => d.light_mins), 'light_mins');
  const avgAwake = avg(data.filter(d => d.awake_mins), 'awake_mins');

  const chartData = data.map(d => ({ x: d.date, y: (d.total_mins || 0) / 60, label: fmtDate(d.date) }));
  const donut = [
    { label: 'Deep',  value: avgDeep  || 0, color: '#6366f1' },
    { label: 'REM',   value: avgRem   || 0, color: '#8b5cf6' },
    { label: 'Light', value: avgLight || 0, color: '#a78bfa' },
    { label: 'Awake', value: avgAwake || 0, color: '#374151' },
  ].filter(s => s.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Avg Sleep" value={avgHours ? fmtMins(avgHours) : '—'} color="#8b5cf6" />
        <StatCard label="Avg Quality" value={avgQuality ? `${avgQuality}%` : '—'} color="var(--accent)" />
        <StatCard label="Avg Deep Sleep" value={avgDeep ? fmtMins(avgDeep) : '—'} color="#6366f1" />
        <StatCard label="Avg REM" value={avgRem ? fmtMins(avgRem) : '—'} color="#a78bfa" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
          <div className="text-sm font-semibold text-white mb-4">Sleep Duration (hours)</div>
          <LineChart data={chartData} color="#8b5cf6" height={200} unit="h" fill />
        </div>
        <div className="col-span-4 bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)] flex flex-col items-center">
          <div className="text-sm font-semibold text-white mb-4">Stage Breakdown (avg)</div>
          <DonutChart segments={donut} size={160} label={avgHours ? `${Math.floor(avgHours/60)}h` : ''} />
        </div>
      </div>
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] text-sm font-semibold text-white">Sleep Sessions</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)]">
            {['Date','Duration','Deep','Light','REM','Awake','Quality'].map(h => (
              <th key={h} className="py-2 px-4 text-left text-xs text-[var(--text-3)] font-semibold uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--card-2)]">
                <td className="py-2.5 px-4 text-[var(--text-2)]">{d.date}</td>
                <td className="py-2.5 px-4 text-white font-medium">{fmtMins(d.total_mins)}</td>
                <td className="py-2.5 px-4 text-indigo-400">{fmtMins(d.deep_mins)}</td>
                <td className="py-2.5 px-4 text-purple-400">{fmtMins(d.light_mins)}</td>
                <td className="py-2.5 px-4 text-violet-400">{fmtMins(d.rem_mins)}</td>
                <td className="py-2.5 px-4 text-[var(--text-3)]">{fmtMins(d.awake_mins)}</td>
                <td className="py-2.5 px-4">
                  {d.quality_score != null && (
                    <span className={`font-bold ${d.quality_score >= 80 ? 'text-emerald-400' : d.quality_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{d.quality_score}%</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HRTab({ data }) {
  if (!data?.length) return <EmptyState tab="heart rate" />;
  const resting = data.filter(d => d.context === 'resting');
  const avgResting = avg(resting, 'bpm');
  const maxBpm = max(data, 'bpm');
  const minBpm = min(data.filter(d => d.context === 'resting'), 'bpm');
  const chartData = resting.slice(-60).map(d => ({ x: d.recorded_at, y: d.bpm, label: fmtDate(d.recorded_at) }));
  const contexts = ['resting','active','workout','sleep'];
  const contextData = contexts.map(c => ({ label: c, value: avg(data.filter(d => d.context === c), 'bpm') || 0 }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Resting HR (avg)" value={avgResting ? `${avgResting} bpm` : '—'} color="#f87171" />
        <StatCard label="Max HR" value={maxBpm ? `${maxBpm} bpm` : '—'} color="var(--danger)" />
        <StatCard label="Min Resting" value={minBpm ? `${minBpm} bpm` : '—'} color="var(--accent)" />
        <StatCard label="Readings" value={data.length} color="#9ca3af" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
          <div className="text-sm font-semibold text-white mb-4">Resting HR Trend</div>
          <LineChart data={chartData} color="#f87171" height={200} unit=" bpm" />
        </div>
        <div className="col-span-4 bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
          <div className="text-sm font-semibold text-white mb-4">Avg HR by Context</div>
          <BarChart data={contextData} color="#f87171" height={160} unit=" bpm" />
        </div>
      </div>
    </div>
  );
}

function BloodTab({ spo2, stress }) {
  if (!spo2?.length && !stress?.length) return <EmptyState tab="blood & O₂" />;
  const avgSpo2   = avg(spo2, 'spo2_pct');
  const minSpo2   = min(spo2, 'spo2_pct');
  const alerts    = spo2.filter(r => r.alert_triggered).length;
  const avgStress = avg(stress, 'stress_score');
  const avgHrv    = avg(stress.filter(s => s.hrv_ms), 'hrv_ms');

  const spo2Chart   = spo2.slice(-60).map(d => ({ x: d.recorded_at, y: d.spo2_pct, label: fmtDate(d.recorded_at) }));
  const stressChart = stress.slice(-60).map(d => ({ x: d.recorded_at, y: d.stress_score, label: fmtDate(d.recorded_at) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Avg SpO₂"   value={avgSpo2   ? `${avgSpo2}%`  : '—'} color="#60a5fa" />
        <StatCard label="Min SpO₂"   value={minSpo2   ? `${minSpo2}%`  : '—'} color="var(--danger)" sub={alerts ? `${alerts} alerts` : ''} />
        <StatCard label="Avg Stress" value={avgStress != null ? avgStress : '—'} color="var(--warning)" />
        <StatCard label="Avg HRV"    value={avgHrv    ? `${avgHrv}ms`  : '—'} color="var(--accent)" />
      </div>
      <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
        <div className="text-sm font-semibold text-white mb-4">SpO₂ Trend</div>
        <LineChart data={spo2Chart} color="#60a5fa" height={180} unit="%" />
      </div>
      <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
        <div className="text-sm font-semibold text-white mb-4">Stress Score Trend</div>
        <LineChart data={stressChart} color="var(--warning)" height={180} unit="" />
      </div>
    </div>
  );
}

function ActivityTab({ data }) {
  if (!data?.length) return <EmptyState tab="activity" />;
  const avgSteps  = avg(data, 'steps');
  const bestSteps = max(data, 'steps');
  const avgActive = avg(data, 'active_mins');
  const weekCals  = data.slice(-7).reduce((s,d) => s + (d.calories_kcal || 0), 0);
  const stepsData = data.slice(-14).map(d => ({ x: d.date, y: d.steps || 0, label: fmtDate(d.date) }));
  const calsData  = data.map(d => ({ x: d.date, y: d.calories_kcal || 0, label: fmtDate(d.date) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Avg Daily Steps"  value={avgSteps  ? avgSteps.toLocaleString()  : '—'} color="var(--accent)" />
        <StatCard label="Week Calories"    value={weekCals  ? Math.round(weekCals).toLocaleString() : '—'} unit=" kcal" color="#fb923c" />
        <StatCard label="Avg Active Mins"  value={avgActive ? `${avgActive}m` : '—'} color="#60a5fa" />
        <StatCard label="Best Day Steps"   value={bestSteps ? bestSteps.toLocaleString() : '—'} color="#fbbf24" />
      </div>
      <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
        <div className="text-sm font-semibold text-white mb-4">Daily Steps (last 14 days)</div>
        <BarChart data={stepsData} color="var(--accent)" height={160} />
      </div>
      <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
        <div className="text-sm font-semibold text-white mb-4">Calories Burned</div>
        <LineChart data={calsData} color="#fb923c" height={180} unit=" kcal" fill />
      </div>
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)] text-sm font-semibold text-white">Daily Activity Log</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--border)]">
            {['Date','Steps','Distance','Calories','Active Mins'].map(h => (
              <th key={h} className="py-2 px-4 text-left text-xs text-[var(--text-3)] font-semibold uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[...data].reverse().map((d, i) => (
              <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--card-2)]">
                <td className="py-2.5 px-4 text-[var(--text-2)]">{d.date}</td>
                <td className="py-2.5 px-4 text-[var(--accent)] font-bold">{(d.steps || 0).toLocaleString()}</td>
                <td className="py-2.5 px-4 text-white">{d.distance_km ? `${d.distance_km.toFixed(1)}km` : '—'}</td>
                <td className="py-2.5 px-4 text-[var(--text-2)]">{d.calories_kcal ? `${Math.round(d.calories_kcal)} kcal` : '—'}</td>
                <td className="py-2.5 px-4 text-[var(--text-2)]">{d.active_mins ? `${d.active_mins}m` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FitnessTab({ fitness, workouts }) {
  if (!fitness?.length && !workouts?.length) return <EmptyState tab="fitness" />;
  const latestVo2 = fitness.filter(d => d.vo2_max).pop()?.vo2_max;
  const avgLoad   = avg(fitness.filter(d => d.training_load), 'training_load');
  const avgRecov  = avg(fitness.filter(d => d.recovery_time_mins), 'recovery_time_mins');
  const vo2Chart  = fitness.filter(d => d.vo2_max).map(d => ({ x: d.date, y: d.vo2_max, label: fmtDate(d.date) }));
  const loadChart = fitness.filter(d => d.training_load).map(d => ({ x: d.date, y: d.training_load, label: fmtDate(d.date) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="VO₂ Max"       value={latestVo2 ? latestVo2.toFixed(1) : '—'} unit=" ml/kg/min" color="var(--accent)" />
        <StatCard label="Avg Train Load" value={avgLoad ? Math.round(avgLoad) : '—'} color="#60a5fa" />
        <StatCard label="Avg Recovery"  value={avgRecov ? `${Math.round(avgRecov)}m` : '—'} color="#fb923c" />
        <StatCard label="Band Workouts" value={workouts?.length || '—'} color="#a78bfa" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
          <div className="text-sm font-semibold text-white mb-4">VO₂ Max Trend</div>
          <LineChart data={vo2Chart} color="var(--accent)" height={180} unit="" />
        </div>
        <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
          <div className="text-sm font-semibold text-white mb-4">Training Load</div>
          <LineChart data={loadChart} color="#60a5fa" height={180} unit="" />
        </div>
      </div>
      {workouts?.length > 0 && (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] text-sm font-semibold text-white">Band Workouts</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)]">
              {['Date','Sport','Duration','Avg HR','Calories','Load'].map(h => (
                <th key={h} className="py-2 px-4 text-left text-xs text-[var(--text-3)] font-semibold uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {workouts.map((w, i) => (
                <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--card-2)]">
                  <td className="py-2.5 px-4 text-[var(--text-2)]">{w.started_at ? new Date(w.started_at).toLocaleDateString() : '—'}</td>
                  <td className="py-2.5 px-4 text-white font-medium capitalize">{w.sport_type}</td>
                  <td className="py-2.5 px-4 text-[var(--accent)]">{fmtDuration(w.duration_secs)}</td>
                  <td className="py-2.5 px-4 text-red-400">{w.avg_hr ? `${w.avg_hr} bpm` : '—'}</td>
                  <td className="py-2.5 px-4 text-[var(--text-2)]">{w.calories_kcal ? `${Math.round(w.calories_kcal)} kcal` : '—'}</td>
                  <td className="py-2.5 px-4 text-[var(--text-2)]">{w.training_load?.toFixed(1) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Health() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({ sleep:[], hr:[], spo2:[], stress:[], activity:[], workouts:[], fitness:[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getSleepHistory(30), getHeartRateHistory(30), getSpo2History(30),
      getStressHistory(30), getActivityHistory(30), getBandWorkouts(30), getFitnessMetrics(30),
    ]).then(([sl,hr,sp,st,ac,wo,fi]) => {
      setData({
        sleep:    sl.status==='fulfilled' ? sl.value.data : [],
        hr:       hr.status==='fulfilled' ? hr.value.data : [],
        spo2:     sp.status==='fulfilled' ? sp.value.data : [],
        stress:   st.status==='fulfilled' ? st.value.data : [],
        activity: ac.status==='fulfilled' ? ac.value.data : [],
        workouts: wo.status==='fulfilled' ? wo.value.data : [],
        fitness:  fi.status==='fulfilled' ? fi.value.data : [],
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 flex flex-col gap-5">
      <h1 className="text-2xl font-black text-white">Health & Body</h1>
      <ImportPanel />

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1 self-start border border-[var(--border)]">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === i ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text-2)] hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array(4).fill(0).map((_,i) => <div key={i} className="h-20 bg-[var(--card)] rounded-2xl animate-pulse border border-[var(--border)]" />)}
        </div>
      ) : (
        <>
          {tab === 0 && <SleepTab   data={data.sleep} />}
          {tab === 1 && <HRTab      data={data.hr} />}
          {tab === 2 && <BloodTab   spo2={data.spo2} stress={data.stress} />}
          {tab === 3 && <ActivityTab data={data.activity} />}
          {tab === 4 && <FitnessTab  fitness={data.fitness} workouts={data.workouts} />}
        </>
      )}
    </div>
  );
}
