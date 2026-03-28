'use client';
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Video, Plus } from 'lucide-react';
import {
  getTodayTraining, checkinTraining, logExercise, completeTraining,
  adminStartTraining, adminResetTimer,
  getTomorrowTraining, getAlternatives, createOverride, deleteOverride, getStretchRecommendations, logRun,
} from '../../../api/trainingCheckinApi.js';
import { createLog } from '../../../api/logsApi.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import Card from '../../../design-system/Card.jsx';
import Button from '../../../design-system/Button.jsx';
import Badge from '../../../design-system/Badge.jsx';
import Skeleton from '../../../design-system/Skeleton.jsx';

const SLOT_ICONS  = { push: '💪', pull: '🔄', legs: '🦵', core: '⚡' };
const WINDOW_MINS = 10;
const TRAINING_DURATION_SECS = 3600;
const ENERGY_EMOJIS = ['😴', '😐', '🙂', '💪', '🔥'];

function pad(n) { return String(n).padStart(2, '0'); }
function fmtSecs(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}
function muscleLabel(m) {
  return (m || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function isWeighted(ex) {
  if (!ex?.required_equipment) return false;
  try {
    const arr = JSON.parse(ex.required_equipment);
    return Array.isArray(arr) && arr.some(e => [
      'dumbbells','barbell','ez_bar','kettlebells','cable_machine','smith_machine',
      'chest_press_machine','shoulder_press_machine','leg_press_machine','hack_squat_machine',
    ].includes(e));
  } catch { return false; }
}
function daysAgoLabel(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return '1d ago';
  return `${diff}d ago`;
}
function getWindowPhase(trainTime) {
  if (!trainTime) return { phase: 'no-schedule' };
  const [sh, sm] = trainTime.split(':').map(Number);
  const now = new Date();
  const start = new Date(now); start.setHours(sh, sm, 0, 0);
  const end   = new Date(now); end.setHours(sh, sm + WINDOW_MINS, 0, 0);
  if (now < start) return { phase: 'waiting', secsUntil: Math.ceil((start - now) / 1000) };
  if (now <= end)  return { phase: 'open',    secsLeft:  Math.ceil((end - now) / 1000) };
  return { phase: 'late' };
}


function recoveryColor(pct) {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}
function recoveryLabel(pct) {
  if (pct == null) return null;
  if (pct >= 80) return { text: 'Ready', cls: 'text-emerald-400' };
  if (pct >= 50) return { text: 'Recovering', cls: 'text-yellow-400' };
  return { text: 'Fatigued', cls: 'text-red-400' };
}

// ── Stretch Recommendations Section ──────────────────────────────────────────
function StretchSection({ date }) {
  const [stretches, setStretches] = useState(null);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getStretchRecommendations(date);
      setStretches(res.data.stretches || []);
    } catch { setStretches([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [date]);

  if (!stretches || stretches.length === 0) return null;

  return (
    <Card className="border border-indigo-800">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧘</span>
          <span className="text-sm font-bold text-white">Recovery Stretches</span>
          <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">{stretches.length}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
          <p className="text-xs text-[var(--text-3)] mb-1">Targeted at muscles you loaded today:</p>
          {loading
            ? <Skeleton className="h-10 w-full" />
            : stretches.map(s => (
              <div key={s.id} className="bg-[var(--card-2)] rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{s.name}</span>
                  <div className="flex items-center gap-2">
                    {s.targets_loaded && (
                      <span className="text-[10px] bg-indigo-900 text-indigo-300 px-1.5 py-0.5 rounded-full">targeted</span>
                    )}
                    <span className="text-xs text-[var(--text-3)] capitalize">{s.difficulty}</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-3)]">{muscleLabel(s.muscle_group)}</p>
                {s.description && (
                  <details className="mt-1.5">
                    <summary className="text-xs text-[var(--accent)] cursor-pointer select-none">How to do it</summary>
                    <p className="text-xs text-[var(--text-2)] mt-1.5 leading-relaxed whitespace-pre-line">
                      {s.description.replace(/\\n/g, '\n')}
                    </p>
                  </details>
                )}
              </div>
            ))
          }
        </div>
      )}
    </Card>
  );
}



// ── Running Card ─────────────────────────────────────────────────────────────
function RunningCard({ plan, onLogged }) {
  const [km, setKm]         = useState('');
  const [logging, setLogging] = useState(false);
  const [done, setDone]     = useState(plan?.today_done || false);
  const isRecovery = plan?.day_type === 'recovery_run';

  async function handleLog() {
    setLogging(true);
    try {
      const p = plan?.plan || plan;
      await logRun({
        attempt_id:         p?.attempt_id,
        current_day:        p?.current_day,
        actual_distance_km: km ? Number(km) : undefined,
      });
      setDone(true);
      onLogged && onLogged();
    } catch (e) { console.error(e); }
    finally { setLogging(false); }
  }

  const targetKm   = plan?.target_distance_km;
  const targetMin  = plan?.target_duration_min || 30;
  const runNum     = plan?.run_number;

  if (done) {
    return (
      <Card className="border border-emerald-800 bg-emerald-900/10 text-center py-6 flex flex-col items-center gap-2">
        <span className="text-5xl">✅</span>
        <div className="text-lg font-black text-emerald-400">
          {isRecovery ? 'Recovery Run Complete!' : `Run #${runNum} Done!`}
        </div>
        {km && <div className="text-sm text-[var(--text-2)]">{Number(km).toFixed(1)} km logged</div>}
      </Card>
    );
  }

  return (
    <Card className={`border ${isRecovery ? 'border-purple-700 bg-purple-900/10' : 'border-blue-700 bg-blue-900/10'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{isRecovery ? '🧘' : '🏃'}</span>
          <div>
            <div className="text-base font-black text-white">
              {isRecovery ? 'Active Recovery Run' : `Run #${runNum}`}
            </div>
            <div className="text-xs text-[var(--text-3)]">
              {isRecovery ? 'Easy pace · 30 min' : 'Progressive run · comfortable pace'}
            </div>
          </div>
        </div>
        {!isRecovery && targetKm && (
          <div className="text-right">
            <div className="text-3xl font-black text-blue-300 tabular-nums">{targetKm}</div>
            <div className="text-xs text-[var(--text-3)]">km target</div>
          </div>
        )}
        {isRecovery && (
          <div className="text-right">
            <div className="text-3xl font-black text-purple-300 tabular-nums">{targetMin}</div>
            <div className="text-xs text-[var(--text-3)]">min target</div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className={`rounded-xl px-4 py-3 mb-4 ${isRecovery ? 'bg-purple-900/20' : 'bg-blue-900/20'}`}>
        {isRecovery ? (
          <p className="text-xs text-purple-300">
            🌿 Easy, conversational pace. This run helps your muscles recover and builds your aerobic base without stress.
          </p>
        ) : (
          <p className="text-xs text-blue-300">
            🎯 Don't worry about pace — just cover the distance comfortably.
            Each run is +10% longer than the last. You've got this!
          </p>
        )}
      </div>

      {/* Log actual distance (optional) */}
      <div className="flex gap-2">
        <input
          type="number" min="0" step="0.1" inputMode="decimal"
          value={km} onChange={e => setKm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLog()}
          placeholder={`Distance (km) · optional`}
          className="flex-1 h-11 px-3 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-white text-sm text-center focus:outline-none focus:border-[var(--accent)]"
        />
        <Button onClick={handleLog} loading={logging} size="sm" className="h-11 px-5 rounded-xl">
          Log Run ✓
        </Button>
      </div>
    </Card>
  );
}

// ── Exercise Card ──────────────────────────────────────────────────────────────
function ExerciseCard({ exercise, targetReps, logs, onLogged }) {
  const [reps, setReps]         = useState('');
  const [weight, setWeight]     = useState('');
  const [adding, setAdding]     = useState(false);
  const [prFlash, setPrFlash]   = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const fileRef = useRef(null);

  const sets  = logs.filter(l => l.exercise_type_id == exercise.id);
  const total = sets.reduce((s, l) => s + (Number(l.reps_done) || 0), 0);
  const done  = targetReps && total >= targetReps;
  const weighted = isWeighted(exercise);
  const last = exercise.last_session;

  async function handleAdd() {
    if (!reps) return;
    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('exercise_type_id', exercise.id);
      fd.append('exercise_name', exercise.name);
      fd.append('reps_done', reps);
      if (weighted && weight) fd.append('weight_kg', weight);
      if (videoFile) fd.append('video', videoFile);
      const res = await logExercise(fd);
      if (res.data.new_pr) { setPrFlash(true); setTimeout(() => setPrFlash(false), 3000); }
      onLogged(res.data.log);
      setReps(''); setWeight(''); setVideoFile(null);
    } catch (e) { console.error(e); }
    finally { setAdding(false); }
  }

  return (
    <Card className={`border transition-all ${prFlash ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : done ? 'border-emerald-800' : 'border-[var(--border)]'}`}>
      {prFlash && (
        <div className="mb-3 text-center py-2 bg-yellow-900/40 border border-yellow-700 rounded-xl text-yellow-400 text-sm font-bold animate-pulse">
          🏆 NEW PR — {exercise.name}!
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{SLOT_ICONS[exercise.slot] || '🏋️'}</span>
          <div>
            <div className="text-sm font-bold text-white">{exercise.name}</div>
            <div className="text-xs text-[var(--text-3)]">{muscleLabel(exercise.muscle_group)}</div>
            {last && (
              <div className="text-xs text-[var(--text-3)] mt-0.5">
                Last: {last.reps_done}r{last.weight_kg ? ` @ ${last.weight_kg}kg` : ''} · {daysAgoLabel(last.date)}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black tabular-nums ${done ? 'text-[var(--accent)]' : 'text-white'}`}>{total}</div>
          {targetReps && (
            <div className={`text-xs ${done ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}>
              {done ? '✓ done' : `/ ${targetReps}`}
            </div>
          )}
        </div>
      </div>

      {sets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {sets.map((s, i) => (
            <span key={i} className="text-xs bg-[var(--accent-dim)] text-[var(--accent)] px-2.5 py-1 rounded-full font-medium">
              {s.reps_done}{s.weight_kg ? ` @ ${s.weight_kg}kg` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="number" min="1" inputMode="numeric"
          value={reps} onChange={e => setReps(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Reps"
          className="w-20 h-11 px-3 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-white text-sm text-center focus:outline-none focus:border-[var(--accent)]"
        />
        {weighted && (
          <input
            type="number" min="0" step="0.5" inputMode="decimal"
            value={weight} onChange={e => setWeight(e.target.value)}
            placeholder="kg"
            className="w-20 h-11 px-3 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-white text-sm text-center focus:outline-none focus:border-[var(--accent)]"
          />
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${videoFile ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] text-[var(--text-3)]'}`}
        >
          <Video className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept="video/*" className="hidden"
          onChange={e => setVideoFile(e.target.files?.[0] ?? null)} />
        <Button
          onClick={handleAdd} loading={adding} disabled={!reps}
          size="sm" className="ml-auto h-11 px-4 rounded-xl"
        >
          + Add
        </Button>
      </div>
    </Card>
  );
}

// ── Tomorrow Section ───────────────────────────────────────────────────────────
function TomorrowSection() {
  const [open, setOpen]         = useState(false);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [swapping, setSwapping] = useState(null);
  const [alts, setAlts]         = useState([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [saving, setSaving]     = useState(false);

  async function load() {
    setLoading(true);
    try { const r = await getTomorrowTraining(); setData(r.data); } catch {}
    finally { setLoading(false); }
  }
  useEffect(() => { if (open && !data) load(); }, [open]);

  async function openSwap(slot) {
    setSwapping(slot); setLoadingAlts(true);
    try { const r = await getAlternatives(slot, data?.date); setAlts(r.data.exercises || []); } catch {}
    finally { setLoadingAlts(false); }
  }
  async function handleSwap(ex) {
    setSaving(true);
    try {
      await createOverride({ date: data.date, slot: swapping, exercise_type_id: ex.id, exercise_name: ex.name });
      setSwapping(null); await load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }
  async function handleRevert(slot) {
    try { await deleteOverride({ date: data.date, slot }); await load(); } catch (e) { console.error(e); }
  }

  const exercises = data?.plan?.exercises || [];
  const targetReps = data?.plan?.target_reps;

  return (
    <Card>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-2)]">Tomorrow's Training</span>
          {data?.plan && !open && (
            <span className={
              data.plan.day_type === 'running'      ? 'text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full' :
              data.plan.day_type === 'recovery_run' ? 'text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full' :
              'text-xs text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded-full'
            }>
              {data.plan.day_type === 'running'      ? `🏃 Run #${data.plan.run_number} · ${data.plan.target_distance_km} km` :
               data.plan.day_type === 'recovery_run' ? '🧘 Recovery Run · 30 min' :
               `💪 Strength · ${data.plan.target_reps} reps`}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
          {loading
            ? <Skeleton className="h-10 w-full" />
            : !data?.plan
              ? <p className="text-sm text-[var(--text-3)] text-center py-2">No program active.</p>
              : data.plan.day_type === 'running'
              ? (
                  <div className="rounded-xl bg-blue-900/20 border border-blue-800 px-4 py-4 flex items-center gap-4">
                    <span className="text-4xl">🏃</span>
                    <div className="flex-1">
                      <div className="text-base font-black text-white">Run #{data.plan.run_number}</div>
                      <div className="text-2xl font-black text-blue-300 leading-none mt-0.5">{data.plan.target_distance_km} km</div>
                      <div className="text-xs text-[var(--text-3)] mt-1">Comfortable pace · no time pressure · +10% from last run</div>
                    </div>
                  </div>
              )
              : data.plan.day_type === 'recovery_run'
              ? (
                  <div className="rounded-xl bg-purple-900/20 border border-purple-800 px-4 py-4 flex items-center gap-4">
                    <span className="text-4xl">🧘</span>
                    <div className="flex-1">
                      <div className="text-base font-black text-white">Recovery Run</div>
                      <div className="text-lg font-bold text-purple-300 mt-0.5">30 min easy</div>
                      <div className="text-xs text-[var(--text-3)] mt-1">Conversational pace · active recovery · Sunday routine</div>
                    </div>
                  </div>
              )
              : exercises.map(ex => (
                <div key={ex.slot} className="flex items-center justify-between bg-[var(--card-2)] rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                    <div>
                      <div className="text-sm text-white font-medium">
                        {ex.name}
                        {ex.overridden && <span className="ml-2 text-[10px] text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded-full">custom</span>}
                      </div>
                      <div className="text-xs text-[var(--text-3)]">{muscleLabel(ex.muscle_group)} · {targetReps} reps</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ex.overridden && (
                      <button onClick={() => handleRevert(ex.slot)} className="text-xs text-[var(--danger)]">Revert</button>
                    )}
                    <button onClick={() => openSwap(ex.slot)} className="text-xs text-[var(--accent)] font-medium">Change</button>
                  </div>
                </div>
              ))
          }
          {swapping && (
            <div className="mt-1 bg-[var(--card-2)] rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">Replace {swapping}</span>
                <button onClick={() => setSwapping(null)} className="text-[var(--text-3)] text-sm">✕</button>
              </div>
              {loadingAlts
                ? <Skeleton className="h-8 w-full" />
                : alts.length === 0
                  ? <p className="text-sm text-[var(--text-3)] text-center py-2">No alternatives.</p>
                  : <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {alts.map(ex => (
                        <button key={ex.id} onClick={() => handleSwap(ex)} disabled={saving}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--card)] text-left active:opacity-70">
                          <span className="text-sm text-white font-medium flex-1">{ex.name}</span>
                          <span className="text-xs text-[var(--text-3)]">{muscleLabel(ex.muscle_group)}</span>
                        </button>
                      ))}
                    </div>
              }
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TrainingPage() {
  const { user } = useAuth();
  const [data, setData]             = useState(null);
  const [exLogs, setExLogs]         = useState([]);
  const [phase, setPhase]           = useState('loading');
  const [winState, setWinState]     = useState({});
  const [trainTimer, setTrainTimer] = useState(null);
  const [busy, setBusy]             = useState(false);
  const [energyRating, setEnergyRating] = useState(null);
  const tickRef  = useRef(null);
  const timerRef = useRef(null);

  async function load() {
    try {
      const res = await getTodayTraining();
      const { checkin: c, train_time, plan: p, exercise_logs, starts_on } = res.data;
      setData(res.data);
      setExLogs(exercise_logs || []);
      derivePhase(c, train_time, starts_on);
    } catch { setPhase('no-program'); }
  }
  function derivePhase(c, trainTime, startsOn) {
    if (!trainTime) { setPhase('no-program'); return; }
    if (startsOn)   { setPhase('starts-tomorrow'); return; }
    if (c?.status === 'active')    { setPhase('active'); return; }
    if (c?.status === 'completed') { setPhase('completed'); return; }
    const ws = getWindowPhase(trainTime);
    if (ws.phase === 'waiting')     setPhase('waiting');
    else if (ws.phase === 'open')   setPhase('window-open');
    else setPhase('late');
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    clearInterval(tickRef.current);
    if (!data?.train_time) return;
    tickRef.current = setInterval(() => {
      setPhase(prev => {
        if (['loading','no-program','starts-tomorrow','active','completed'].includes(prev)) return prev;
        const ws = getWindowPhase(data.train_time);
        setWinState(ws);
        if (ws.phase === 'waiting') return 'waiting';
        if (ws.phase === 'open')    return 'window-open';
        return 'late';
      });
      setWinState(getWindowPhase(data.train_time));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [data?.train_time]);
  useEffect(() => {
    clearInterval(timerRef.current);
    const checkin = data?.checkin;
    if (phase === 'active' && checkin?.checked_in_at) {
      const elapsed = Math.floor((Date.now() - new Date(checkin.checked_in_at + 'Z').getTime()) / 1000);
      const rem = Math.max(TRAINING_DURATION_SECS - elapsed, 0);
      setTrainTimer(rem);
      timerRef.current = setInterval(() => {
        setTrainTimer(p => { if (!p || p <= 0) { clearInterval(timerRef.current); return 0; } return p - 1; });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, data?.checkin?.checked_in_at]);

  async function handleCheckin() {
    setBusy(true);
    try { await checkinTraining(energyRating ? { energy_rating: energyRating } : {}); await load(); }
    catch { await load(); } finally { setBusy(false); }
  }
  async function handleComplete() {
    setBusy(true);
    try {
      const res = await completeTraining();
      setData(prev => ({ ...prev, checkin: res.data.checkin }));
      setPhase('completed');
      const fresh = await getTodayTraining();
      setExLogs(fresh.data.exercise_logs || []);
    } catch (e) { console.error(e); } finally { setBusy(false); }
  }
  function handleNewLog(log) { setExLogs(prev => [...prev, log]); }
  async function handleAdminStart() {
    setBusy(true);
    try { await adminStartTraining(); await load(); }
    catch (e) { console.error(e); } finally { setBusy(false); }
  }
  async function handleResetTimer() {
    try {
      const res = await adminResetTimer();
      setData(prev => ({ ...prev, checkin: res.data.checkin }));
    } catch (e) { console.error(e); }
  }

  const checkin    = data?.checkin;
  const trainTime  = data?.train_time;
  const plan       = data?.plan;
  const exercises  = plan?.exercises || [];
  const targetReps = plan?.target_reps;
  const isLate     = checkin?.late_checkin === 1;

  if (phase === 'loading') return (
    <div className="flex flex-col gap-4 px-4 pt-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Training</h1>
        <div className="flex items-center gap-2">
          {plan && <Badge variant="neutral">Day {plan.current_day} · Ph{plan.phase_number}</Badge>}
          {isLate && <Badge variant="warning">Late</Badge>}
          {checkin?.status === 'completed' && <Badge variant="success">Done ✓</Badge>}
        </div>
      </div>

      {/* No program */}
      {phase === 'no-program' && (
        <Card className="text-center py-8 flex flex-col items-center gap-3">
          <span className="text-5xl">🎯</span>
          <div className="text-white font-bold">No active program</div>
          <p className="text-sm text-[var(--text-2)]">Start the 60-day program to get a daily training schedule.</p>
        </Card>
      )}

      {/* Starts tomorrow */}
      {phase === 'starts-tomorrow' && (
        <Card className="text-center py-8 flex flex-col items-center gap-3">
          <span className="text-5xl">🗓</span>
          <div className="text-white font-bold">Program starts tomorrow</div>
          <p className="text-sm text-[var(--text-2)]">Training at {data?.train_time} · Day 1 preview:</p>
          <div className="w-full flex flex-col gap-2 mt-1">
            {(data?.plan?.exercises || []).map(ex => (
              <div key={ex.id} className="flex items-center gap-2 bg-[var(--card-2)] rounded-xl px-3 py-2.5">
                <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                <span className="text-sm text-white">{ex.name}</span>
                <span className="ml-auto text-xs text-[var(--text-3)]">{muscleLabel(ex.muscle_group)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Scheduled time */}
      {trainTime && phase !== 'no-program' && phase !== 'starts-tomorrow' && (
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--text-3)] uppercase tracking-wide">Scheduled</div>
            <div className="text-4xl font-black text-white tabular-nums mt-0.5">{trainTime}</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">10-min window</div>
          </div>
          <div>
            {phase === 'window-open' && (
              <Badge variant="warning">
                Open · {winState.secsLeft != null ? fmtSecs(winState.secsLeft) : ''}
              </Badge>
            )}
            {phase === 'waiting' && (
              <span className="text-sm text-[var(--text-2)]">
                in {winState.secsUntil != null ? fmtSecs(winState.secsUntil) : '—'}
              </span>
            )}
            {phase === 'late' && <Badge variant="warning">Late — can train</Badge>}
            {phase === 'active' && trainTimer != null && (
              <div className="text-right">
                <div className="text-2xl font-black text-[var(--accent)] tabular-nums">{fmtSecs(trainTimer)}</div>
                <div className="text-xs text-[var(--text-3)]">remaining</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Waiting — preview */}
      {phase === 'waiting' && exercises.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--text-3)] uppercase tracking-wide font-semibold">
            {plan?.day_type === 'running' ? `🏃 Run #${plan.run_number} — ${plan.target_distance_km} km` : plan?.day_type === 'recovery_run' ? '🧘 Recovery Run — 30 min easy' : "💪 Today's Exercises"}
          </p>
          {exercises.map(ex => (
            <div key={ex.id} className="flex items-center gap-3 bg-[var(--card)] rounded-xl px-4 py-3">
              <span className="text-xl">{plan?.day_type === 'cardio' ? (CARDIO_SLOT_ICONS[ex.slot] || '🏃') : (SLOT_ICONS[ex.slot] || '🏋️')}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{ex.name}</div>
                <div className="text-xs text-[var(--text-3)]">{ex.label || muscleLabel(ex.muscle_group)}</div>
              </div>
              {ex.target_duration_mins
                ? <span className="text-sm font-bold text-blue-300">{ex.target_duration_mins} min</span>
                : ex.target_reps
                ? <span className="text-sm font-bold text-[var(--text-2)]">{ex.target_reps} reps</span>
                : targetReps
                ? <span className="text-sm font-bold text-[var(--text-2)]">{targetReps} reps</span>
                : null
              }
            </div>
          ))}
        </div>
      )}

      {/* Window open — priming + energy + check in */}
      {(phase === 'window-open' || phase === 'late') && (
        <div className="flex flex-col gap-3">
          {plan && exercises.length > 0 && (
            <Card elevated className="border border-[var(--accent-dim)]">
              <div className="text-xs text-[var(--accent)] uppercase tracking-wider font-semibold mb-3">
                Day {plan.current_day} of 60 · Phase {plan.phase_number}
              </div>
              <p className="text-white text-sm font-bold mb-3">
                {plan.day_type === 'cardio' ? "🏃 Cardio Day — Active Recovery" : "Today's Mission"}
              </p>
              <div className="flex flex-col gap-2 mb-3">
                {exercises.map(ex => (
                  <div key={ex.id} className="flex items-center gap-2 text-sm">
                    <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                    <span className="flex-1 text-[var(--text-2)]">{ex.name}</span>
                    {ex.last_session && (
                      <span className="text-xs text-[var(--text-3)]">
                        last {ex.last_session.reps_done}r{ex.last_session.weight_kg ? ` @${ex.last_session.weight_kg}kg` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-3)] italic">Set your intention. Then start.</p>
            </Card>
          )}

          {/* Energy rating */}
          <Card>
            <p className="text-xs text-[var(--text-2)] text-center mb-3">How are you feeling today?</p>
            <div className="flex justify-center gap-3">
              {ENERGY_EMOJIS.map((emoji, i) => (
                <button key={i} onClick={() => setEnergyRating(i + 1)}
                  className={`text-2xl w-12 h-12 rounded-2xl transition-all ${
                    energyRating === i + 1
                      ? 'bg-[var(--accent-dim)] ring-2 ring-[var(--accent)]'
                      : 'bg-[var(--card-2)]'
                  }`}>
                  {emoji}
                </button>
              ))}
            </div>
          </Card>

          <Button onClick={handleCheckin} loading={busy} fullWidth size="lg"
            className="bg-yellow-500 text-black hover:bg-yellow-400 rounded-2xl font-black text-lg shadow-lg shadow-yellow-500/20">
            ✋ Check In Now
          </Button>
        </div>
      )}

      {/* Active — exercise cards */}
      {phase === 'active' && (
        <div className="flex flex-col gap-3">
          {(plan?.day_type === 'running' || plan?.day_type === 'recovery_run') ? (
            <>
              <RunningCard plan={plan} onLogged={load} />
            </>
          ) : (
            <>
              {/* Recovery overview pill row (strength days only) */}
              {plan?.muscle_recovery && Object.keys(plan.muscle_recovery).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(plan.muscle_recovery).map(([muscle, rec]) => {
                    const lbl = recoveryLabel(rec.recovery_pct);
                    return (
                      <span key={muscle} className={`text-[10px] px-2 py-1 rounded-full font-medium ${rec.recovery_pct >= 80 ? 'bg-emerald-900/50 text-emerald-400' : rec.recovery_pct >= 50 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                        {muscleLabel(muscle)} {rec.recovery_pct}%
                      </span>
                    );
                  })}
                </div>
              )}
              {exercises.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  targetReps={targetReps}
                  logs={exLogs}
                  onLogged={handleNewLog}
                  muscleRecovery={plan?.muscle_recovery}
                />
              ))}
            </>
          )}
          <Button onClick={handleComplete} loading={busy} fullWidth size="lg"
            className="mt-2 rounded-2xl font-black text-lg">
            Complete Session ✓
          </Button>
          {user?.is_admin && (
            <Button onClick={handleResetTimer} variant="ghost" size="sm" fullWidth>
              Admin: Reset Timer
            </Button>
          )}
        </div>
      )}

      {/* Completed */}
      {phase === 'completed' && (
        <Card className="text-center py-8 flex flex-col items-center gap-3 border border-emerald-800">
          <span className="text-6xl">🏆</span>
          <div className="text-2xl font-black text-[var(--accent)]">Session Complete!</div>
          <p className="text-[var(--text-2)] text-sm">
            {(plan?.day_type === 'running' || plan?.day_type === 'recovery_run')
              ? (plan?.day_type === 'recovery_run' ? '30 min recovery run completed' : `Run #${plan.run_number} · ${plan.target_distance_km} km target`)
              : `${exLogs.length} set${exLogs.length !== 1 ? 's' : ''} logged · ${exLogs.reduce((s, l) => s + (Number(l.reps_done) || 0), 0)} total reps`
            }
          </p>
          {exLogs.length > 0 && (
            <div className="w-full flex flex-wrap gap-1.5 justify-center mt-1">
              {exLogs.map((l, i) => (
                <span key={i} className="text-xs bg-[var(--accent-dim)] text-[var(--accent)] px-2.5 py-1 rounded-full">
                  {l.exercise_name}: {l.reps_done}r{l.weight_kg ? ` @ ${l.weight_kg}kg` : ''}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Stretch recommendations after session */}
      {phase === 'completed' && <StretchSection date={new Date().toISOString().split('T')[0]} />}

      {/* Admin controls */}
      {user?.is_admin && phase !== 'completed' && phase !== 'active' && (
        <Button onClick={handleAdminStart} variant="secondary" fullWidth size="sm">
          Admin: Force Start
        </Button>
      )}

      {/* Tomorrow + extra logger always visible */}
      {phase !== 'loading' && <TomorrowSection />}

      <div className="h-2" />
    </div>
  );
}
