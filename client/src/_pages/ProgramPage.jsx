'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext.jsx';
import Card from '../design-system/Card.jsx';
import Badge from '../design-system/Badge.jsx';
import { getProgramStatus, generatePreview, setupProgram, resetProgram, getProgramGrid } from '../api/programApi.js';

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function addMins(hhmm, mins) {
  if (!hhmm) return '--:--';
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}
function calcWake(leaveTime, customMorningMins = 0) {
  return addMins(leaveTime, -(100 + customMorningMins));
}
function calcBedtime(wakeTime) {
  return addMins(wakeTime, -(7 * 60));
}
function fmtTime(t) {
  if (!t || t === '--:--') return t || '--:--';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function runKm(n) { return (3.0 * Math.pow(1.055, n - 1)).toFixed(1); }

const PHASE_COLORS = ['text-blue-400', 'text-orange-400', 'text-red-400'];
const PHASE_BG    = ['bg-blue-900/30 border-blue-800/40', 'bg-orange-900/30 border-orange-800/40', 'bg-red-900/30 border-red-800/40'];
const DAY_ICONS   = { push: '💪', pull: '🏋️', legs: '🦵', run: '🏃', recovery_run: '🚶' };
const DAY_LABELS  = { push: 'Push', pull: 'Pull', legs: 'Legs', run: 'Run', recovery_run: '15-min Walk' };
const STATUS_COLOR = { completed: 'bg-emerald-500', missed: 'bg-red-500', today: 'bg-[var(--accent)]', upcoming: 'bg-[var(--card-2)]' };

/* ─── Sub-components ────────────────────────────────────────────────────────── */

function PhaseCard({ phase, index }) {
  return (
    <div className={`rounded-xl border p-4 ${PHASE_BG[index]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${PHASE_COLORS[index]}`}>Phase {phase.phase} — {phase.name}</span>
        <span className="text-xs text-[var(--text-3)]">Days {phase.day_start}–{phase.day_end}</span>
      </div>
      <p className="text-2xl font-black text-white">{phase.target_reps} reps</p>
      <p className="text-xs text-[var(--text-3)] mt-1">per exercise · 4 exercises per session</p>
    </div>
  );
}

function RunPreviewRow({ n }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--text-3)]">Run {n}</span>
      <span className="text-sm font-semibold text-white">{runKm(n)} km</span>
    </div>
  );
}

function DotGrid({ days }) {
  if (!days?.length) return null;
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div className="space-y-1.5">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex gap-1.5">
          {week.map(d => (
            <div key={d.day} title={`Day ${d.day}: ${d.day_type} — ${d.status}`}
              className={`flex-1 h-5 rounded-sm ${STATUS_COLOR[d.status] || 'bg-[var(--card-2)]'}`} />
          ))}
          {week.length < 7 && Array(7 - week.length).fill(0).map((_, i) => (
            <div key={`e${i}`} className="flex-1" />
          ))}
        </div>
      ))}
      <div className="flex gap-3 mt-2 flex-wrap">
        {[['bg-emerald-500','Done'],['bg-red-500','Missed'],['bg-[var(--accent)]','Today'],['bg-[var(--card-2)]','Upcoming']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${c}`} />
            <span className="text-[10px] text-[var(--text-3)]">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Wizard ────────────────────────────────────────────────────────────────── */
function Wizard({ tryNumber, onDone }) {
  const [step, setStep]           = useState(1);
  const [leaveTime, setLeaveTime] = useState('08:00');
  const [returnTime, setReturnTime] = useState('17:30');
  const [morningTasks, setMorningTasks] = useState([]);
  const [eveningTasks, setEveningTasks] = useState([]);
  const [newTask, setNewTask]     = useState({ name: '', icon: '📌', duration_mins: 15, time_of_day: 'morning' });
  const [weight, setWeight]       = useState('');
  const [height, setHeight]       = useState('');
  const [preview, setPreview]     = useState(null);
  const [saving, setSaving]       = useState(false);

  const customMorningTotal = morningTasks.reduce((s, t) => s + t.duration_mins, 0);
  const wakeTime  = calcWake(leaveTime, customMorningTotal);
  const bedtime   = calcBedtime(wakeTime);
  const stretchTime = addMins(bedtime, -65);

  useEffect(() => {
    if (step === 4) generatePreview().then(r => setPreview(r.data)).catch(() => {});
  }, [step]);

  function addTask() {
    if (!newTask.name.trim()) return;
    const task = { ...newTask, id: Date.now(), duration_mins: Number(newTask.duration_mins) || 15 };
    if (task.time_of_day === 'morning') setMorningTasks(p => [...p, task]);
    else setEveningTasks(p => [...p, task]);
    setNewTask({ name: '', icon: '📌', duration_mins: 15, time_of_day: 'morning' });
  }

  function removeTask(id, tod) {
    if (tod === 'morning') setMorningTasks(p => p.filter(t => t.id !== id));
    else setEveningTasks(p => p.filter(t => t.id !== id));
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      // Save custom tasks
      const allTasks = [...morningTasks, ...eveningTasks];
      for (const t of allTasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ name: t.name, icon: t.icon, duration_mins: t.duration_mins, time_of_day: t.time_of_day }),
        });
      }
      await setupProgram({ work_leave_time: leaveTime, return_time: returnTime, start_weight: weight ? Number(weight) : undefined, start_height: height ? Number(height) : undefined });
      onDone();
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  const stepLabels = ['Schedule', 'Tasks', 'Stats', 'Confirm'];

  return (
    <div className="flex flex-col gap-4">
      {/* Step indicator */}
      <div className="flex gap-1">
        {stepLabels.map((l, i) => (
          <div key={l} className={`flex-1 h-1 rounded-full ${i < step ? 'bg-[var(--accent)]' : 'bg-[var(--card-2)]'}`} />
        ))}
      </div>
      <p className="text-xs text-[var(--text-3)] text-center">Step {step} of 4 — {stepLabels[step - 1]}</p>

      {step === 1 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">Work Schedule</h2>
          <div>
            <label className="text-xs text-[var(--text-3)] block mb-1">Leave for work</label>
            <input type="time" value={leaveTime} onChange={e => setLeaveTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-3)] block mb-1">Return from work</label>
            <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-white text-sm" />
          </div>
          <div className="rounded-xl bg-[var(--card-2)] p-3 space-y-1.5">
            <p className="text-xs font-semibold text-[var(--text-2)] mb-2">Calculated Schedule</p>
            {[['⏰','Wake up', fmtTime(wakeTime)],['🧊','Cold Plunge', fmtTime(wakeTime)],['💪','Training', fmtTime(addMins(wakeTime, 10))],['🚿','Shower', fmtTime(addMins(wakeTime, 70))],['🚶','Leave', fmtTime(leaveTime)],['🌙','Bedtime', fmtTime(bedtime)],['🤸','Stretch', fmtTime(stretchTime)]].map(([icon,label,time]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[var(--text-3)]">{icon} {label}</span>
                <span className="text-white font-medium">{time}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setStep(2)} className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm">Next →</button>
        </Card>
      )}

      {step === 2 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">Custom Tasks</h2>
          <p className="text-xs text-[var(--text-3)]">Add extra tasks to your morning or evening routine. Morning tasks shift your wake time earlier.</p>

          {/* Morning tasks */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-2)] mb-2">🌅 Morning (after shower)</p>
            {morningTasks.length === 0 && <p className="text-xs text-[var(--text-3)] italic">No custom tasks</p>}
            {morningTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
                <span className="text-sm text-white">{t.icon} {t.name} <span className="text-[var(--text-3)]">({t.duration_mins}min)</span></span>
                <button onClick={() => removeTask(t.id, 'morning')} className="text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>

          {/* Evening tasks */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-2)] mb-2">🌙 Evening (before stretch)</p>
            {eveningTasks.length === 0 && <p className="text-xs text-[var(--text-3)] italic">No custom tasks</p>}
            {eveningTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
                <span className="text-sm text-white">{t.icon} {t.name} <span className="text-[var(--text-3)]">({t.duration_mins}min)</span></span>
                <button onClick={() => removeTask(t.id, 'evening')} className="text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>

          {/* Add task form */}
          <div className="rounded-xl bg-[var(--card-2)] p-3 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-2)]">Add Task</p>
            <div className="flex gap-2">
              <input value={newTask.icon} onChange={e => setNewTask(p => ({...p, icon: e.target.value}))}
                className="w-12 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white text-sm text-center" />
              <input value={newTask.name} onChange={e => setNewTask(p => ({...p, name: e.target.value}))}
                placeholder="Task name" className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white text-sm" />
            </div>
            <div className="flex gap-2">
              <input type="number" value={newTask.duration_mins} onChange={e => setNewTask(p => ({...p, duration_mins: e.target.value}))}
                className="w-20 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white text-sm" />
              <span className="text-xs text-[var(--text-3)] self-center">min</span>
              <select value={newTask.time_of_day} onChange={e => setNewTask(p => ({...p, time_of_day: e.target.value}))}
                className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white text-sm">
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <button onClick={addTask} className="w-full py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--accent)] text-sm font-semibold">+ Add</button>
          </div>

          {customMorningTotal > 0 && (
            <p className="text-xs text-yellow-400">⏰ Wake time adjusted to {fmtTime(calcWake(leaveTime, customMorningTotal))} ({customMorningTotal} extra mins)</p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-2)] text-sm">← Back</button>
            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm">Next →</button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">Starting Measurements</h2>
          <p className="text-xs text-[var(--text-3)]">Optional — used for progress tracking.</p>
          <div>
            <label className="text-xs text-[var(--text-3)] block mb-1">Body weight (kg)</label>
            <input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 75"
              className="w-full px-3 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-3)] block mb-1">Height (cm)</label>
            <input type="number" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)}
              placeholder="e.g. 178"
              className="w-full px-3 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-2)] text-sm">← Back</button>
            <button onClick={() => setStep(4)} className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm">Next →</button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">Confirm Program</h2>
          <div className="rounded-xl bg-[var(--card-2)] p-3 space-y-1.5">
            <p className="text-xs font-semibold text-[var(--text-2)] mb-2">Your Schedule</p>
            {[['⏰','Wake', fmtTime(wakeTime)],['🚶','Leave', fmtTime(leaveTime)],['🏠','Return', fmtTime(returnTime)],['🌙','Bedtime', fmtTime(bedtime)],['🤸','Stretch', fmtTime(stretchTime)]].map(([i,l,t]) => (
              <div key={l} className="flex justify-between text-xs">
                <span className="text-[var(--text-3)]">{i} {l}</span>
                <span className="text-white font-medium">{t}</span>
              </div>
            ))}
          </div>
          {preview?.phases && (
            <div className="space-y-2">
              {preview.phases.map((ph, i) => <PhaseCard key={ph.phase} phase={ph} index={i} />)}
            </div>
          )}
          <p className="text-xs text-[var(--text-3)] text-center">3 strikes across 60 days = restart</p>
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-2)] text-sm">← Back</button>
            <button onClick={handleConfirm} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm disabled:opacity-50">
              {saving ? 'Starting…' : `Start Try #${tryNumber}`}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Active program view ────────────────────────────────────────────────────── */
function ActiveView({ status, onReset }) {
  const [grid, setGrid]         = useState(null);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    getProgramGrid().then(r => setGrid(r.data)).catch(() => {});
  }, []);

  const { current_day, phase_name, phase_number, target_reps, strikes = 0, today_plan, try_number } = status;
  const pct = Math.round((current_day / 60) * 100);
  const dayType = today_plan?.day_type;

  async function handleReset() {
    await resetProgram();
    onReset();
  }

  const SAMPLE_RUNS = [1, 5, 10, 15, 20, 25];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--text-3)]">Try #{try_number}</p>
            <h2 className="text-xl font-black text-white">Day {current_day} / 60</h2>
            <p className={`text-sm font-semibold ${PHASE_COLORS[phase_number - 1] || 'text-white'}`}>Phase {phase_number} — {phase_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-3)]">Strikes</p>
            <div className="flex gap-1 justify-end mt-1">
              {[0,1,2].map(i => (
                <span key={i} className={`text-lg ${i < strikes ? 'text-red-400' : 'text-[var(--text-3)]'}`}>⚡</span>
              ))}
            </div>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{strikes}/3</p>
          </div>
        </div>
        {/* Progress bar */}
        <div>
          <div className="h-2 bg-[var(--card-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-[var(--text-3)] mt-1 text-right">{pct}% complete</p>
        </div>
      </Card>

      {/* Today's plan */}
      {today_plan && (
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Today</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{DAY_ICONS[dayType]}</span>
            <div>
              <h3 className="text-base font-black text-white">
                {dayType === 'run' ? `Run — ${today_plan.target_distance_km} km`
                 : dayType === 'recovery_run' ? '15-min Easy Run'
                 : `${DAY_LABELS[dayType]} — ${target_reps} reps`}
              </h3>
              {today_plan.exercises?.length > 0 && (
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  {today_plan.exercises.map(e => e.name).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <Link href="/schedule">
            <button className="mt-4 w-full py-2.5 rounded-xl bg-[var(--accent)] text-white font-bold text-sm">
              Go to Schedule →
            </button>
          </Link>
        </Card>
      )}

      {/* Running progression */}
      <Card>
        <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Running Progression</p>
        <div className="flex items-center justify-between mb-3">
          <div className="text-center">
            <p className="text-2xl font-black text-white">3.0</p>
            <p className="text-xs text-[var(--text-3)]">Start (km)</p>
          </div>
          <div className="flex-1 mx-3 h-px bg-[var(--border)] relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs text-[var(--text-3)]">→</div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-emerald-400">11+</p>
            <p className="text-xs text-[var(--text-3)]">Goal (km)</p>
          </div>
        </div>
        <div className="space-y-0">
          {SAMPLE_RUNS.map(n => <RunPreviewRow key={n} n={n} />)}
        </div>
        <p className="text-xs text-[var(--text-3)] mt-2 text-center">+5.5% per run · Sundays = 15-min easy</p>
      </Card>

      {/* 60-day grid */}
      {grid?.days && (
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">60-Day Grid</p>
          <DotGrid days={grid.days} />
        </Card>
      )}

      {/* Reset */}
      <div className="mt-2">
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="w-full py-2 text-xs text-[var(--text-3)] border border-[var(--border)] rounded-xl">
            Abandon Program
          </button>
        ) : (
          <Card>
            <p className="text-sm text-white mb-3">Abandon this attempt? Your progress will be lost.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowReset(false)} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] text-sm">Cancel</button>
              <button onClick={handleReset} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-sm">Abandon</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── Overview (not started) ────────────────────────────────────────────────── */
function Overview({ tryNumber, onStart }) {
  const weekDays = [
    { day: 'Mon', type: 'push',         icon: '💪', label: 'Push Strength' },
    { day: 'Tue', type: 'run',          icon: '🏃', label: 'Run' },
    { day: 'Wed', type: 'pull',         icon: '🏋️', label: 'Pull Strength' },
    { day: 'Thu', type: 'run',          icon: '🏃', label: 'Run' },
    { day: 'Fri', type: 'legs',         icon: '🦵', label: 'Legs Strength' },
    { day: 'Sat', type: 'run',          icon: '🏃', label: 'Run' },
    { day: 'Sun', type: 'recovery_run', icon: '🚶', label: '15-min Easy + Stretch' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-center py-6 gap-2">
        <span className="text-5xl">🏋️</span>
        <h1 className="text-2xl font-black text-white">60-Day Program</h1>
        <p className="text-sm text-[var(--text-3)] text-center">Foundation → Build → Peak</p>
        {tryNumber > 1 && <Badge variant="neutral">Try #{tryNumber}</Badge>}
      </Card>

      {/* 3 phases */}
      <div className="space-y-2">
        {[{phase:1,name:'Foundation',day_start:1,day_end:20,target_reps:100},{phase:2,name:'Build',day_start:21,day_end:40,target_reps:200},{phase:3,name:'Peak',day_start:41,day_end:60,target_reps:300}].map((p, i) => (
          <PhaseCard key={p.phase} phase={p} index={i} />
        ))}
      </div>

      {/* Weekly pattern */}
      <Card>
        <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Weekly Pattern</p>
        {weekDays.map(({ day, icon, label }) => (
          <div key={day} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
            <span className="text-xs text-[var(--text-3)] w-8">{day}</span>
            <span className="text-base">{icon}</span>
            <span className="text-sm text-white">{label}</span>
          </div>
        ))}
      </Card>

      {/* Running */}
      <Card>
        <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Running 3km → 11km+</p>
        {[1,5,10,15,20,25].map(n => <RunPreviewRow key={n} n={n} />)}
        <p className="text-xs text-[var(--text-3)] mt-2 text-center">~5.5% increase per run</p>
      </Card>

      {/* Strike rule */}
      <Card className="flex flex-col items-center py-4 gap-2">
        <div className="flex gap-2">
          <span className="text-2xl">⚡</span><span className="text-2xl">⚡</span><span className="text-2xl">⚡</span>
        </div>
        <p className="text-sm font-bold text-white">3-Strike Rule</p>
        <p className="text-xs text-[var(--text-3)] text-center">Miss 3 workouts or runs across 60 days → program resets to Day 1</p>
      </Card>

      <button onClick={onStart} className="w-full py-4 rounded-2xl bg-[var(--accent)] text-white font-black text-base">
        Start Try #{tryNumber}
      </button>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */
export default function ProgramPage() {
  const [status,  setStatus]  = useState(null);
  const [wizard,  setWizard]  = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getProgramStatus();
      setStatus(r.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive   = status?.active;
  const tryNumber  = status?.try_number || 1;

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Program</h1>
        {isActive && (
          <Badge variant="success">Active</Badge>
        )}
      </div>

      {wizard ? (
        <Wizard tryNumber={tryNumber} onDone={() => { setWizard(false); load(); }} />
      ) : isActive ? (
        <ActiveView status={status} onReset={() => { load(); }} />
      ) : (
        <Overview tryNumber={tryNumber} onStart={() => setWizard(true)} />
      )}

      <div className="h-2" />
    </div>
  );
}
