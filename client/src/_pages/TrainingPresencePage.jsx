'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  getTodayTraining, checkinTraining, logExercise, completeTraining,
  adminStartTraining, adminResetTimer,
  getTomorrowTraining, getAlternatives, createOverride, deleteOverride,
} from '../api/trainingCheckinApi.js';
import { createLog } from '../api/logsApi.js';
import ExerciseSelector from '../components/workout/ExerciseSelector.jsx';
import StrengthForm from '../components/workout/StrengthForm.jsx';
import CardioForm from '../components/workout/CardioForm.jsx';
import VideoUploader from '../components/workout/VideoUploader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const SLOT_ICONS  = { push: '💪', pull: '🔄', legs: '🦵', core: '⚡' };
const WINDOW_MINS = 10;
const TRAINING_DURATION_SECS = 3600;

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    if (!Array.isArray(arr)) return false;
    return arr.some(e => ['dumbbells','barbell','ez_bar','kettlebells','cable_machine','smith_machine',
      'chest_press_machine','shoulder_press_machine','leg_press_machine','hack_squat_machine'].includes(e));
  } catch { return false; }
}

function getWindowPhase(trainTime) {
  if (!trainTime) return { phase: 'no-schedule' };
  const [sh, sm] = trainTime.split(':').map(Number);
  const now = new Date();
  const start = new Date(now); start.setHours(sh, sm, 0, 0);
  const end   = new Date(now); end.setHours(sh, sm + WINDOW_MINS, 0, 0);
  if (now < start)  return { phase: 'waiting',  secsUntil: Math.ceil((start - now) / 1000) };
  if (now <= end)   return { phase: 'open',      secsLeft:  Math.ceil((end - now) / 1000) };
  return { phase: 'late' };
}

// ── Exercise card (active phase) ──────────────────────────────────────────────
function daysAgoLabel(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return '1d ago';
  return `${diff}d ago`;
}

function ExerciseCard({ exercise, targetReps, logs, onLogged }) {
  const [reps,      setReps]      = useState('');
  const [weight,    setWeight]    = useState('');
  const [adding,    setAdding]    = useState(false);
  const [prFlash,   setPrFlash]   = useState(false);
  const fileRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);

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
      fd.append('exercise_name',    exercise.name);
      fd.append('reps_done',        reps);
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
    <div className={`bg-gray-900 rounded-xl p-4 border transition-colors ${prFlash ? 'border-yellow-500' : done ? 'border-emerald-700' : 'border-gray-800'}`}>
      {prFlash && (
        <div className="mb-2 text-center py-1.5 bg-yellow-900/40 border border-yellow-600 rounded-lg text-yellow-400 text-sm font-bold animate-pulse">
          🏆 NEW PR — {exercise.name}!
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{SLOT_ICONS[exercise.slot] || '🏋️'}</span>
          <div>
            <div className="text-sm font-bold text-white">{exercise.name}</div>
            <div className="text-xs text-gray-500">{muscleLabel(exercise.muscle_group)}</div>
            {last && (
              <div className="text-xs text-gray-600 mt-0.5">
                Last: {last.reps_done}r{last.weight_kg ? ` @ ${last.weight_kg}kg` : ''} · {daysAgoLabel(last.date)}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black tabular-nums ${done ? 'text-emerald-400' : 'text-white'}`}>{total}</div>
          {targetReps && <div className={`text-xs ${done ? 'text-emerald-500' : 'text-gray-500'}`}>{done ? '✓ done' : `/ ${targetReps}`}</div>}
        </div>
      </div>

      {sets.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {sets.map((s, i) => (
            <span key={i} className="text-xs bg-gray-800 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
              {s.reps_done}{s.weight_kg ? ` @ ${s.weight_kg}kg` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input type="number" min="1" value={reps} onChange={e => setReps(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Reps" className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
        {weighted && (
          <input type="number" min="0" step="0.5" value={weight} onChange={e => setWeight(e.target.value)}
            placeholder="kg" className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
        )}
        <button onClick={() => fileRef.current?.click()} title="Video"
          className={`p-2 rounded-lg border text-sm ${videoFile ? 'border-emerald-500 text-emerald-400' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
          📹
        </button>
        <input ref={fileRef} type="file" accept="video/*" className="hidden"
          onChange={e => setVideoFile(e.target.files?.[0] ?? null)} />
        <button onClick={handleAdd} disabled={adding || !reps}
          className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm rounded-lg transition-colors">
          {adding ? '…' : '+ Add'}
        </button>
      </div>
    </div>
  );
}

// ── Tomorrow's training + edit ────────────────────────────────────────────────
function TomorrowSection() {
  const [open, setOpen]       = useState(false);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(null);
  const [alts, setAlts]       = useState([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [saving, setSaving]   = useState(false);

  async function load() {
    setLoading(true);
    try { const r = await getTomorrowTraining(); setData(r.data); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { if (open && !data) load(); }, [open]);

  async function openSwap(slot) {
    setSwapping(slot);
    setLoadingAlts(true);
    try {
      const r = await getAlternatives(slot, data?.date);
      setAlts(r.data.exercises || []);
    } catch {}
    finally { setLoadingAlts(false); }
  }

  async function handleSwap(ex) {
    setSaving(true);
    try {
      await createOverride({ date: data.date, slot: swapping, exercise_type_id: ex.id, exercise_name: ex.name });
      setSwapping(null);
      await load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleRevert(slot) {
    try {
      await deleteOverride({ date: data.date, slot });
      await load();
    } catch (e) { console.error(e); }
  }

  const exercises = data?.plan?.exercises || [];
  const targetReps = data?.plan?.target_reps;

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold text-gray-300">Tomorrow's Training</span>
        <span className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 flex flex-col gap-2">
          {loading
            ? <div className="text-center py-4 text-gray-500 text-sm">Loading…</div>
            : !data?.plan
              ? <p className="text-sm text-gray-600 text-center py-2">No program active.</p>
              : exercises.map(ex => (
                <div key={ex.slot} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                    <div>
                      <div className="text-sm text-white font-medium">
                        {ex.name}
                        {ex.overridden && <span className="ml-1.5 text-[10px] text-yellow-400 bg-yellow-900/30 px-1 rounded">custom</span>}
                      </div>
                      <div className="text-xs text-gray-500">{muscleLabel(ex.muscle_group)} · {targetReps} reps</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ex.overridden && (
                      <button onClick={() => handleRevert(ex.slot)}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors">Revert</button>
                    )}
                    <button onClick={() => openSwap(ex.slot)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                      Change →
                    </button>
                  </div>
                </div>
              ))
          }

          {swapping && (
            <div className="mt-2 flex flex-col gap-2 bg-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Replace {swapping} exercise
                </span>
                <button onClick={() => setSwapping(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
              </div>
              {loadingAlts
                ? <div className="text-center py-3 text-gray-500 text-sm">Loading alternatives…</div>
                : alts.length === 0
                  ? <p className="text-sm text-gray-600 text-center py-2">No alternatives found.</p>
                  : <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                      {alts.map(ex => (
                        <button key={ex.id} onClick={() => handleSwap(ex)} disabled={saving}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-700 transition-colors text-left">
                          <span className="text-sm text-white font-medium flex-1">{ex.name}</span>
                          <span className="text-xs text-gray-500">{muscleLabel(ex.muscle_group)}</span>
                        </button>
                      ))}
                    </div>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Exercises preview (read-only) ─────────────────────────────────────────────
function ExerciseList({ exercises, targetReps, repTotals }) {
  if (!exercises?.length) return null;
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
        Today's Exercises
        {targetReps && <span className="ml-2 text-yellow-400 normal-case font-bold">· {targetReps} reps each</span>}
      </div>
      <div className="flex flex-col gap-2">
        {exercises.map(ex => {
          const done = repTotals?.[ex.id] >= (targetReps || Infinity);
          return (
            <div key={ex.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                <div>
                  <div className="text-sm font-medium text-white">{ex.name}</div>
                  <div className="text-xs text-gray-500">{muscleLabel(ex.muscle_group)}</div>
                </div>
              </div>
              {targetReps && (
                <span className={`text-sm font-bold ${done ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {repTotals?.[ex.id] ?? 0} / {targetReps}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Extra workout logger ──────────────────────────────────────────────────────
function ExtraWorkoutLogger() {
  const [open, setOpen]             = useState(false);
  const [exercise, setExercise]     = useState(null);
  const [strengthVals, setStrength] = useState({ sets: '', reps: '' });
  const [cardioVals, setCardio]     = useState({ distance_km: '', duration_min: '' });
  const [notes, setNotes]           = useState('');
  const [videoFile, setVideoFile]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');

  async function handleSubmit() {
    if (!exercise) return setError('Select an exercise');
    setLoading(true);
    setError('');
    const fd = new FormData();
    fd.append('exercise_type_id', exercise.id);
    if (exercise.category === 'strength') {
      if (strengthVals.sets) fd.append('sets', strengthVals.sets);
      if (strengthVals.reps) fd.append('reps', strengthVals.reps);
    } else {
      if (cardioVals.distance_km) fd.append('distance_km', cardioVals.distance_km);
      if (cardioVals.duration_min) fd.append('duration_secs', parseInt(cardioVals.duration_min) * 60);
    }
    if (notes) fd.append('notes', notes);
    if (videoFile) fd.append('video', videoFile);
    try {
      await createLog(fd);
      setSuccess(true);
      setExercise(null);
      setStrength({ sets: '', reps: '' });
      setCardio({ distance_km: '', duration_min: '' });
      setNotes('');
      setVideoFile(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log workout');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold text-gray-300">
          ➕ Log Extra Workout
          <span className="ml-2 text-xs text-gray-500 font-normal">running, extra sets, etc.</span>
        </span>
        <span className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 flex flex-col gap-4">
          {success && (
            <div className="bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-2.5 text-emerald-400 text-sm font-semibold">
              ✓ Workout logged!
            </div>
          )}

          <ExerciseSelector value={exercise} onChange={setExercise} />

          {exercise && (
            <div className="flex flex-col gap-3">
              {exercise.category === 'cardio'
                ? <CardioForm values={cardioVals} onChange={setCardio} />
                : <StrengthForm values={strengthVals} onChange={setStrength} />
              }

              <VideoUploader onFile={setVideoFile} />

              <input
                type="text"
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !exercise}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
          >
            {loading ? 'Logging…' : 'Log Workout'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrainingPresencePage() {
  const { user } = useAuth();
  return <UnifiedTrainingView isAdmin={!!user?.is_admin} />;
}

const ENERGY_EMOJIS = ['😴', '😐', '🙂', '💪', '🔥'];

function UnifiedTrainingView({ isAdmin }) {
  const [data,         setData]         = useState(null);
  const [exLogs,       setExLogs]       = useState([]);
  const [phase,        setPhase]        = useState('loading');
  const [winState,     setWinState]     = useState({});
  const [trainTimer,   setTrainTimer]   = useState(null);
  const [busy,         setBusy]         = useState(false);
  const [energyRating, setEnergyRating] = useState(null);
  const tickRef      = useRef(null);
  const timerRef     = useRef(null);

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
    if (startsOn) { setPhase('starts-tomorrow'); return; }
    if (c?.status === 'active')    { setPhase('active'); return; }
    if (c?.status === 'completed') { setPhase('completed'); return; }
    const ws = getWindowPhase(trainTime);
    if (ws.phase === 'waiting') setPhase('waiting');
    else if (ws.phase === 'open') setPhase('window-open');
    else setPhase('late');
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    clearInterval(tickRef.current);
    if (!data?.train_time) return;
    tickRef.current = setInterval(() => {
      setPhase(prev => {
        if (['loading','no-program','active','completed'].includes(prev)) return prev;
        const ws = getWindowPhase(data.train_time);
        setWinState(ws);
        if (ws.phase === 'waiting')  return 'waiting';
        if (ws.phase === 'open')     return 'window-open';
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
    try {
      await checkinTraining(energyRating ? { energy_rating: energyRating } : {});
      await load();
    } catch { await load(); }
    finally { setBusy(false); }
  }

  async function handleAdminStart() {
    setBusy(true);
    try {
      await adminStartTraining();
      await load();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  async function handleComplete() {
    setBusy(true);
    try {
      const res = await completeTraining();
      setData(prev => ({ ...prev, checkin: res.data.checkin }));
      setPhase('completed');
      const fresh = await getTodayTraining();
      setExLogs(fresh.data.exercise_logs || []);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  async function handleResetTimer() {
    try {
      const res = await adminResetTimer();
      setData(prev => ({ ...prev, checkin: res.data.checkin }));
    } catch (e) { console.error(e); }
  }

  function handleNewLog(log) {
    setExLogs(prev => [...prev, log]);
  }

  if (phase === 'loading') return <div className="flex justify-center py-20 text-gray-400">Loading…</div>;

  const checkin    = data?.checkin;
  const trainTime  = data?.train_time;
  const plan       = data?.plan;
  const exercises  = plan?.exercises || [];
  const targetReps = plan?.target_reps;
  const repTotals  = plan?.rep_totals || {};
  const isLate     = checkin?.late_checkin === 1;
  const timedOut   = trainTimer === 0;

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Training</h1>
        {plan && (
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">
            Day {plan.current_day} · Phase {plan.phase_number}
          </span>
        )}
      </div>

      {/* No program */}
      {phase === 'no-program' && (
        <div className="bg-gray-900 rounded-2xl p-6 text-center flex flex-col gap-2">
          <div className="text-4xl mb-1">🎯</div>
          <div className="text-white font-bold">No active program</div>
          <div className="text-sm text-gray-500">Start the 60-day program to get a daily training schedule, or log a workout below.</div>
        </div>
      )}

      {/* Starts tomorrow */}
      {phase === 'starts-tomorrow' && (
        <div className="bg-gray-900 rounded-2xl p-6 text-center flex flex-col gap-2">
          <div className="text-4xl mb-1">🗓</div>
          <div className="text-white font-bold">Program starts tomorrow</div>
          <div className="text-sm text-gray-500">Your 60-day program begins on {data?.starts_on}. Prepare tonight — training at {data?.train_time}.</div>
          {data?.plan?.exercises?.length > 0 && (
            <div className="mt-3 text-left">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">Day 1 exercises</div>
              {data.plan.exercises.map(ex => (
                <div key={ex.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-1">
                  <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                  <span className="text-sm text-white">{ex.name}</span>
                  <span className="ml-auto text-xs text-gray-500">{(ex.muscle_group||'').replace(/_/g,' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduled time card */}
      {trainTime && (
        <div className="bg-gray-900 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Scheduled</div>
            <div className="text-3xl font-black text-white tabular-nums mt-0.5">{trainTime}</div>
            <div className="text-xs text-gray-600 mt-0.5">10-min check-in window</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {phase === 'window-open' && (
              <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full animate-pulse">
                Window open · {winState.secsLeft != null ? fmtSecs(winState.secsLeft) : ''}
              </span>
            )}
            {phase === 'late' && (
              <span className="text-xs bg-orange-900/50 text-orange-400 px-2 py-0.5 rounded-full">
                ⚠ Late — can still train
              </span>
            )}
            {phase === 'waiting' && (
              <span className="text-xs text-gray-500">
                Opens in {winState.secsUntil != null ? fmtSecs(winState.secsUntil) : '—'}
              </span>
            )}
            {isLate && phase === 'active' && (
              <span className="text-xs bg-orange-900/50 text-orange-400 px-2 py-0.5 rounded-full">Late start</span>
            )}
            {checkin?.status === 'completed' && (
              <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">✓ Done</span>
            )}
          </div>
        </div>
      )}

      {/* Waiting */}
      {phase === 'waiting' && (
        <ExerciseList exercises={exercises} targetReps={targetReps} repTotals={repTotals} />
      )}

      {/* Window open — priming prompt + energy + check in */}
      {phase === 'window-open' && (
        <div className="flex flex-col gap-3">
          {/* A4: Priming prompt */}
          {plan && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <div className="text-xs text-emerald-400 uppercase tracking-widest font-semibold mb-1">
                Day {plan.current_day} of 60 · Phase {plan.phase_number}
              </div>
              <div className="text-white text-sm font-bold mb-2">Today's Mission</div>
              <div className="flex flex-col gap-1 mb-3">
                {exercises.map(ex => (
                  <div key={ex.id} className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                    <span className="flex-1">{ex.name}</span>
                    {ex.last_session && (
                      <span className="text-gray-600">
                        last: {ex.last_session.reps_done}r{ex.last_session.weight_kg ? ` @${ex.last_session.weight_kg}kg` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600 italic">Set your intention. Then start.</div>
            </div>
          )}
          <ExerciseList exercises={exercises} targetReps={targetReps} repTotals={repTotals} />
          {/* A3: Energy rating */}
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
            <div className="text-xs text-gray-500 mb-2 text-center">How are you feeling today?</div>
            <div className="flex justify-center gap-3">
              {ENERGY_EMOJIS.map((emoji, i) => (
                <button key={i} onClick={() => setEnergyRating(i + 1)}
                  className={`text-2xl p-2 rounded-lg transition-colors ${energyRating === i + 1 ? 'bg-emerald-700 ring-2 ring-emerald-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleCheckin} disabled={busy}
            className="w-full py-6 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-2xl text-xl transition-all shadow-lg shadow-yellow-500/30">
            {busy ? 'Checking in…' : '✋ Check In Now'}
          </button>
        </div>
      )}

      {/* Late — can still check in */}
      {phase === 'late' && (
        <div className="flex flex-col gap-3">
          <div className="bg-orange-900/20 border border-orange-800 rounded-xl p-3 text-center">
            <div className="text-orange-400 text-sm font-semibold">You missed the check-in window</div>
            <div className="text-gray-500 text-xs mt-0.5">You can still train — it will be marked as late</div>
          </div>
          {plan && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <div className="text-xs text-emerald-400 uppercase tracking-widest font-semibold mb-2">
                Day {plan.current_day} of 60 · Phase {plan.phase_number}
              </div>
              {exercises.map(ex => (
                <div key={ex.id} className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                  <span className="flex-1">{ex.name}</span>
                  {ex.last_session && (
                    <span className="text-gray-600">
                      last: {ex.last_session.reps_done}r{ex.last_session.weight_kg ? ` @${ex.last_session.weight_kg}kg` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <ExerciseList exercises={exercises} targetReps={targetReps} repTotals={repTotals} />
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
            <div className="text-xs text-gray-500 mb-2 text-center">How are you feeling today?</div>
            <div className="flex justify-center gap-3">
              {ENERGY_EMOJIS.map((emoji, i) => (
                <button key={i} onClick={() => setEnergyRating(i + 1)}
                  className={`text-2xl p-2 rounded-lg transition-colors ${energyRating === i + 1 ? 'bg-emerald-700 ring-2 ring-emerald-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <button onClick={isAdmin ? handleAdminStart : handleCheckin} disabled={busy}
            className="w-full py-5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black rounded-2xl text-lg transition-colors">
            {busy ? 'Starting…' : '▶ Start Training (Late)'}
          </button>
        </div>
      )}

      {/* Active — exercise log cards + timer */}
      {phase === 'active' && (
        <div className="flex flex-col gap-3">
          <div className={`rounded-2xl p-4 text-center border ${timedOut ? 'bg-red-900/40 border-red-700' : timerRef && trainTimer < 300 ? 'bg-orange-900/30 border-orange-700/50' : 'bg-gray-900 border-gray-700'}`}>
            <div className={`text-xs uppercase tracking-widest mb-1 ${timedOut ? 'text-red-400 animate-pulse' : 'text-gray-500'}`}>
              {timedOut ? 'Time up — complete now!' : 'Time Remaining'}
            </div>
            <div className={`text-5xl font-black tabular-nums ${timedOut ? 'text-red-400' : trainTimer !== null && trainTimer < 300 ? 'text-orange-400' : 'text-white'}`}>
              {trainTimer !== null ? fmtSecs(trainTimer) : '01:00:00'}
            </div>
            {isAdmin && (
              <button onClick={handleResetTimer}
                className="mt-2 px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors">
                ↺ Reset Timer
              </button>
            )}
          </div>

          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} targetReps={targetReps} logs={exLogs} onLogged={handleNewLog} />
          ))}

          <button onClick={handleComplete} disabled={busy}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl text-lg transition-colors">
            {busy ? 'Saving…' : 'Complete Training ✓'}
          </button>
        </div>
      )}

      {/* Completed */}
      {phase === 'completed' && (
        <div className="flex flex-col gap-3">
          <div className="bg-emerald-900/40 border border-emerald-700 rounded-2xl p-6 text-center">
            <div className="text-5xl mb-2">✓</div>
            <div className="text-emerald-400 text-2xl font-black">Training Complete</div>
            {checkin?.completed_at && (
              <div className="text-emerald-300 text-sm mt-1">
                Finished at {new Date(checkin.completed_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {isLate && <span className="ml-2 text-orange-400 text-xs">(late start)</span>}
              </div>
            )}
          </div>

          {exercises.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">Session Summary</div>
              <div className="flex flex-col gap-2">
                {exercises.map(ex => {
                  const sets = exLogs.filter(l => l.exercise_type_id == ex.id);
                  const total = sets.reduce((s, l) => s + (Number(l.reps_done) || 0), 0);
                  const done  = targetReps && total >= targetReps;
                  const maxWeight = sets.reduce((m, l) => Math.max(m, l.weight_kg || 0), 0);
                  return (
                    <div key={ex.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span>{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                        <span className="text-sm text-white">{ex.name}</span>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-black ${done ? 'text-emerald-400' : 'text-yellow-400'}`}>
                          {total} reps {done ? '✓' : ''}
                        </div>
                        {maxWeight > 0 && <div className="text-xs text-gray-500">max {maxWeight}kg</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tomorrow's training (visible when program active) */}
      {phase !== 'no-program' && plan && (
        <TomorrowSection />
      )}

      {/* Extra workout logger — always visible */}
      <ExtraWorkoutLogger />
    </div>
  );
}
