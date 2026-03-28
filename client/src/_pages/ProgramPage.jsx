'use client';
import React, { useEffect, useState } from 'react';
import { getProgramStatus, generatePreview, setupProgram, getProgramGrid, resetProgram } from '../api/programApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/shared/Button.jsx';
import Spinner from '../components/shared/Spinner.jsx';
import Input from '../components/shared/Input.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────
const PHASE_COLORS  = ['text-blue-400',    'text-purple-400',  'text-orange-400',  'text-pink-400'];
const PHASE_BG      = ['bg-blue-950 border-blue-800', 'bg-purple-950 border-purple-800', 'bg-orange-950 border-orange-800', 'bg-pink-950 border-pink-800'];
const SLOT_ICONS    = { push: '💪', pull: '🔄', legs: '🦵', core: '⚡' };

const WEEK_DAYS = [
  { label: 'Mon', type: 'strength',     icon: '💪', color: 'bg-orange-900/40 border-orange-700', text: 'text-orange-300',  title: 'Strength' },
  { label: 'Tue', type: 'running',      icon: '🏃', color: 'bg-blue-900/40 border-blue-700',    text: 'text-blue-300',    title: 'Run' },
  { label: 'Wed', type: 'strength',     icon: '💪', color: 'bg-orange-900/40 border-orange-700', text: 'text-orange-300',  title: 'Strength' },
  { label: 'Thu', type: 'running',      icon: '🏃', color: 'bg-blue-900/40 border-blue-700',    text: 'text-blue-300',    title: 'Run' },
  { label: 'Fri', type: 'strength',     icon: '💪', color: 'bg-orange-900/40 border-orange-700', text: 'text-orange-300',  title: 'Strength' },
  { label: 'Sat', type: 'running',      icon: '🏃', color: 'bg-blue-900/40 border-blue-700',    text: 'text-blue-300',    title: 'Run' },
  { label: 'Sun', type: 'recovery_run', icon: '🧘', color: 'bg-purple-900/40 border-purple-700', text: 'text-purple-300', title: 'Recovery Run' },
];

// Running progression: 3.0km × 1.10^(n-1) for runs 1-15
const RUNNING_PROG = Array.from({ length: 15 }, (_, i) => ({
  run: i + 1,
  km:  Math.round(3.0 * Math.pow(1.10, i) * 10) / 10,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function addMins(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total  = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function fmt(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function calcSchedule(leaveTime, returnTime) {
  if (!leaveTime) return null;
  const wake        = '05:05';
  const coldPlunge  = '05:10';
  const train       = '05:20';
  const shower      = '06:20';
  const medit       = '06:35';
  const bedtime     = addMins(wake, -(8 * 60));
  const stretch     = addMins(bedtime, -45);
  return { wake, coldPlunge, train, shower, medit, leave: leaveTime, returnTime, stretch, bedtime };
}
function getDayType(day) {
  const pos = ((day - 1) % 7) + 1;
  if (pos === 7) return 'recovery_run';
  if (pos % 2 === 0) return 'running';
  return 'strength';
}
function dayTypeStyle(type) {
  if (type === 'strength')     return { icon: '💪', color: 'bg-orange-900/50 border-orange-700', text: 'text-orange-300', label: 'Strength' };
  if (type === 'running')      return { icon: '🏃', color: 'bg-blue-900/50 border-blue-700',    text: 'text-blue-300',   label: 'Run' };
  if (type === 'recovery_run') return { icon: '🧘', color: 'bg-purple-900/50 border-purple-700', text: 'text-purple-300', label: 'Recovery' };
  return { icon: '·', color: 'bg-gray-800', text: 'text-gray-500', label: '' };
}

// ── Schedule Preview ──────────────────────────────────────────────────────────
function ScheduleRow({ icon, label, time, note }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-base w-6 text-center">{icon}</span>
      <div className="flex-1">
        <div className="text-sm text-white">{label}</div>
        {note && <div className="text-xs text-gray-500">{note}</div>}
      </div>
      <div className="text-sm font-bold text-emerald-400">{fmt(time)}</div>
    </div>
  );
}
function SchedulePreview({ sched }) {
  if (!sched) return null;
  const coldPlunge = sched.coldPlunge || sched.cold_plunge_time;
  return (
    <div className="flex flex-col gap-3">
      {/* Morning */}
      <div>
        <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-1.5 px-1">🌅 Morning</div>
        <div className="bg-gray-800 rounded-xl overflow-hidden divide-y divide-gray-700">
          <ScheduleRow icon="⏰" label="Wake up" time={sched.wake} />
          <ScheduleRow icon="🧊" label="Cold plunge" time={coldPlunge || '05:10'} note="5 min" />
          <ScheduleRow icon="💪" label="Training" time={sched.train} />
          <ScheduleRow icon="🚿" label="Shower & prep" time={sched.shower} note="15 min" />
          <ScheduleRow icon="🧘" label="Morning meditation" time={sched.medit} note="1 hour" />
          {sched.leave && <ScheduleRow icon="🚶" label="Leave for work" time={sched.leave} />}
        </div>
      </div>
      {/* Evening */}
      {(sched.returnTime || sched.stretch || sched.bedtime) && (
        <div>
          <div className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-1.5 px-1">🌆 Evening</div>
          <div className="bg-gray-800 rounded-xl overflow-hidden divide-y divide-gray-700">
            {sched.returnTime && <ScheduleRow icon="🏠" label="Return from work" time={sched.returnTime} />}
            {sched.stretch && <ScheduleRow icon="🤸" label="Evening stretch" time={sched.stretch} note="30 min" />}
            {sched.bedtime && <ScheduleRow icon="🌙" label="Bedtime" time={sched.bedtime} note="8h sleep" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Program Overview (not started) ───────────────────────────────────────────
function ProgramOverview({ onStart, status }) {
  const [showRunTable, setShowRunTable] = useState(false);
  return (
    <div className="flex flex-col gap-5">

      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
        <div className="text-4xl mb-3">🏆</div>
        <h1 className="text-2xl font-black text-white mb-1">60-Day Strength + Running</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Build muscle and running endurance simultaneously. Every single day has a purpose — no rest days, just varied intensity.
        </p>
        {status?.failure && (
          <div className="mt-4 bg-red-900/40 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
            You missed Day {status.failure.failedOnDay}. Program reset.{' '}
            {status.total_tries > 0 && `Try #${status.total_tries + 1} ready.`}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { num: '60', label: 'Days' },
            { num: '8',  label: 'Weeks' },
            { num: '4',  label: 'Phases' },
          ].map(s => (
            <div key={s.label} className="bg-black/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-emerald-400">{s.num}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Structure */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">📅 Weekly Structure</h2>
        <div className="grid grid-cols-7 gap-1">
          {WEEK_DAYS.map(d => (
            <div key={d.label} className={`rounded-xl border p-2 text-center flex flex-col items-center gap-1 ${d.color}`}>
              <div className="text-[10px] text-gray-500 font-medium">{d.label}</div>
              <div className="text-xl">{d.icon}</div>
              <div className={`text-[9px] font-bold ${d.text} leading-tight text-center`}>{d.title}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
          <span><span className="text-orange-300">💪</span> 3× strength / week</span>
          <span><span className="text-blue-300">🏃</span> 3× progressive runs</span>
          <span><span className="text-purple-300">🧘</span> Sunday recovery run</span>
        </div>
      </div>

      {/* Strength Training */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">💪 Strength Training</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-900/50 border border-orange-700 flex items-center justify-center text-sm shrink-0">4</div>
            <div>
              <div className="text-sm font-semibold text-white">4 exercises per session</div>
              <div className="text-xs text-gray-400">Push · Pull · Legs · Core — one from each slot</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-900/50 border border-yellow-700 flex items-center justify-center text-base shrink-0">↑</div>
            <div>
              <div className="text-sm font-semibold text-white">Progressive rep targets</div>
              <div className="text-xs text-gray-400">Week 1: <span className="text-yellow-400 font-bold">100 reps</span> per exercise · Week 2: <span className="text-orange-400 font-bold">150 reps</span> per exercise</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-900/50 border border-purple-700 flex items-center justify-center text-base shrink-0">🔄</div>
            <div>
              <div className="text-sm font-semibold text-white">Exercises rotate every phase</div>
              <div className="text-xs text-gray-400">4 phases × 14 days = different exercises each phase. The app picks based on your muscle recovery status.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-900/50 border border-red-800 flex items-center justify-center text-base shrink-0">⚠️</div>
            <div>
              <div className="text-sm font-semibold text-white">Miss one day = restart</div>
              <div className="text-xs text-gray-400">Discipline is the whole point. Miss a day and you go back to Day 1.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Running Progression */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-1">🏃 Running Progression</h2>
        <p className="text-xs text-gray-500 mb-4">Every run is +10% longer than the last. Start easy, build consistency.</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Start', value: '3.0 km', color: 'text-blue-400' },
            { label: 'Growth', value: '+10%', color: 'text-yellow-400' },
            { label: 'Goal', value: '11+ km', color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center">
              <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progression table */}
        <button
          onClick={() => setShowRunTable(p => !p)}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-3"
        >
          {showRunTable ? '▲ Hide' : '▼ Show'} all 15 progressive runs
        </button>
        {showRunTable && (
          <div className="grid grid-cols-5 gap-1">
            <div className="text-[10px] text-gray-500 text-center pb-1">Run</div>
            <div className="text-[10px] text-gray-500 text-center pb-1 col-span-2">Distance</div>
            <div className="text-[10px] text-gray-500 text-center pb-1 col-span-2">Week</div>
            {RUNNING_PROG.map(r => (
              <React.Fragment key={r.run}>
                <div className="text-xs text-gray-400 text-center bg-gray-800 rounded px-1 py-1.5 font-mono">#{r.run}</div>
                <div className={`text-xs font-bold text-center bg-gray-800 rounded px-1 py-1.5 col-span-2 ${r.km >= 8 ? 'text-emerald-400' : r.km >= 5 ? 'text-yellow-400' : 'text-blue-300'}`}>{r.km} km</div>
                <div className="text-[10px] text-gray-500 text-center bg-gray-800 rounded px-1 py-1.5 col-span-2">Wk {Math.ceil(r.run / 3)}</div>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="mt-3 bg-blue-950/40 border border-blue-900 rounded-xl px-4 py-3">
          <div className="text-xs text-blue-300 font-semibold mb-1">🧘 Sunday Recovery Run</div>
          <div className="text-xs text-gray-400">Every Sunday: 30 minutes at easy, conversational pace. Not about distance — just keep moving and let your muscles recover.</div>
        </div>
      </div>

      {/* CTA */}
      <div className="pb-6">
        <Button onClick={onStart} className="w-full py-4 text-base font-black rounded-2xl">
          {status?.total_tries > 0 ? `🔥 Start Try #${status.total_tries + 1}` : '🚀 Start 60-Day Program'}
        </Button>
        <p className="text-xs text-gray-600 text-center mt-2">Sets up your daily schedule and generates your training plan</p>
      </div>
    </div>
  );
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────
function SetupWizard({ onSetupComplete, onBack, status }) {
  const { user, refreshUser } = useAuth();
  const [step, setStep]         = useState(1);
  const [leaveTime, setLeaveTime] = useState('08:00');
  const [returnTime, setReturnTime] = useState('17:30');
  const [weight, setWeight]     = useState(user?.initial_weight || '');
  const [height, setHeight]     = useState(user?.initial_height || '');
  const [phases, setPhases]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const sched = calcSchedule(leaveTime, returnTime);

  async function handlePreview() {
    setLoading(true); setError('');
    try {
      const res = await generatePreview();
      setPhases(res.data.phases);
      setStep(3);
    } catch { setError('Failed to generate program. Make sure equipment is set up in your profile.'); }
    finally { setLoading(false); }
  }

  async function handleStart() {
    setSaving(true); setError('');
    try {
      await setupProgram({
        start_weight:    parseFloat(weight) || null,
        start_height:    parseFloat(height) || null,
        work_leave_time: leaveTime,
        return_time:     returnTime,
      });
      await refreshUser();
      onSetupComplete();
    } catch { setError('Failed to start program.'); }
    finally { setSaving(false); }
  }

  const STEPS = ['Schedule', 'Measurements', 'Your plan'];

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">← Back to overview</button>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((label, i) => {
            const s = i + 1;
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step >= s ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-gray-700 text-gray-500'}`}>{s}</div>
                  <span className={`text-sm hidden sm:block ${step === s ? 'text-white font-medium' : 'text-gray-500'}`}>{label}</span>
                </div>
                {s < STEPS.length && <div className={`flex-1 h-0.5 ${step > s ? 'bg-emerald-500' : 'bg-gray-700'}`} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step 1: Schedule */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Daily Schedule</h2>
            <p className="text-gray-400 text-sm mb-5">Morning routine is fixed. Set your work hours to complete the daily schedule.</p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Leave for work</label>
                <input type="time" value={leaveTime} onChange={e => setLeaveTime(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Return from work</label>
                <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            {sched && (
              <>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your daily routine</div>
                <SchedulePreview sched={sched} />
                <p className="text-xs text-gray-600 mt-2">Bedtime = 8h before wake · Train 1h · Shower 15min · Meditate 1h · Evening: 30min stretch</p>
              </>
            )}
            <Button onClick={() => setStep(2)} className="w-full mt-5">Next →</Button>
          </>
        )}

        {/* Step 2: Measurements */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Starting Measurements</h2>
            <p className="text-gray-400 text-sm mb-5">Track your transformation over 60 days.</p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <Input label="Weight (kg)" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 80.5" />
              <Input label="Height (cm)" type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 175" />
            </div>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={handlePreview} disabled={loading} className="flex-1">
                {loading ? <span className="flex items-center gap-2 justify-center"><Spinner size="sm" />Generating...</span> : 'Generate Plan →'}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Preview phases */}
        {step === 3 && phases && (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Your Strength Phases</h2>
            <p className="text-gray-400 text-sm mb-4">Running progression is the same for everyone. Your strength exercises are personalised to your equipment.</p>
            <div className="flex flex-col gap-3 mb-5">
              {phases.map((phase, idx) => (
                <div key={phase.phase} className={`rounded-xl border p-4 ${PHASE_BG[idx % 4]}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-bold ${PHASE_COLORS[idx % 4]}`}>Phase {phase.phase}</span>
                    <span className="text-xs text-gray-400">Days {phase.day_start}–{phase.day_end} · Strength days only</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(phase.exercises || []).map(ex => (
                      <div key={ex.id} className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2 py-1.5">
                        <span className="text-sm">{SLOT_ICONS[ex.slot] || '🏋️'}</span>
                        <div>
                          <div className="text-xs font-medium text-white leading-tight">{ex.name}</div>
                          <div className="text-[10px] text-gray-500 capitalize">{(ex.muscle_group||'').replace('_',' ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={handleStart} disabled={saving} className="flex-1">
                {saving ? 'Starting...' : '🚀 Start Program'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Active Program ────────────────────────────────────────────────────────────
function ActiveProgram({ status, grid, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting]       = useState(false);
  const [activeWeek, setActiveWeek]     = useState(null); // which week to show in grid

  const plan          = status?.today_plan;
  const currentDay    = status?.current_day || 1;
  const completedDays = grid.filter(d => d.status === 'completed').length;
  const pct           = Math.round((completedDays / 60) * 100);

  // Current week number (1-based)
  const currentWeek  = Math.ceil(currentDay / 7);
  const totalWeeks   = 8;
  const displayWeek  = activeWeek ?? currentWeek;

  // Grid split by weeks
  const weeks = Array.from({ length: totalWeeks }, (_, i) => grid.slice(i * 7, i * 7 + 7));

  // Running stats
  const progressiveRuns = grid.filter(d => d.day_type === 'running' && d.status === 'completed').length;
  const nextRunNum      = progressiveRuns + 1;
  const nextRunKm       = Math.round(3.0 * Math.pow(1.10, progressiveRuns) * 10) / 10;

  async function doReset() {
    setResetting(true);
    try { await resetProgram(); onReset(); }
    catch (e) { console.error(e); }
    finally { setResetting(false); setConfirmReset(false); }
  }

  const todayStyle = plan ? dayTypeStyle(plan.day_type) : null;

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">60-Day Program</h1>
          <div className="text-sm text-gray-400 mt-0.5">Try #{status?.try_number} · Phase {plan?.phase_number || '—'}</div>
        </div>
        <div>
          {!confirmReset
            ? <button onClick={() => setConfirmReset(true)} className="text-xs text-gray-600 hover:text-red-400">Reset</button>
            : <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Sure?</span>
                <button onClick={doReset} disabled={resetting} className="text-xs bg-red-700 text-white px-2 py-1 rounded">{resetting ? '…' : 'Yes'}</button>
                <button onClick={() => setConfirmReset(false)} className="text-xs text-gray-400">No</button>
              </div>
          }
        </div>
      </div>

      {/* Day + Progress */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-5xl font-black text-emerald-400 leading-none">Day {currentDay}</div>
            <div className="text-sm text-gray-400 mt-1">{completedDays} of 60 days complete</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-white">{pct}%</div>
            <div className="text-xs text-gray-500">done</div>
          </div>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
        </div>
        <div className="flex gap-2 mt-2 text-xs text-gray-600">
          <span>{completedDays} done</span>
          <span>·</span>
          <span>{60 - completedDays} remaining</span>
          <span>·</span>
          <span>Week {currentWeek} of 8</span>
        </div>
      </div>

      {/* Today's plan */}
      {plan && todayStyle && (
        <div className={`rounded-2xl border p-5 ${todayStyle.color}`}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Today</div>
          <div className="flex items-center gap-3">
            <span className="text-5xl">{todayStyle.icon}</span>
            <div className="flex-1">
              {plan.day_type === 'strength' && (
                <>
                  <div className="text-xl font-black text-white">Strength Day</div>
                  <div className={`text-sm ${todayStyle.text}`}>
                    {plan.target_reps} reps × 4 exercises · Phase {plan.phase_number}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(plan.exercises || []).map(ex => (
                      <span key={ex.id} className="text-xs bg-black/30 text-orange-300 px-2 py-0.5 rounded-full">
                        {SLOT_ICONS[ex.slot]} {ex.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {plan.day_type === 'running' && (
                <>
                  <div className="text-xl font-black text-white">Run #{plan.run_number}</div>
                  <div className={`text-2xl font-black ${todayStyle.text}`}>{plan.target_distance_km} km</div>
                  <div className="text-xs text-gray-400 mt-1">Comfortable pace · no time pressure</div>
                </>
              )}
              {plan.day_type === 'recovery_run' && (
                <>
                  <div className="text-xl font-black text-white">Recovery Run</div>
                  <div className={`text-sm ${todayStyle.text}`}>30 minutes · easy conversational pace</div>
                  <div className="text-xs text-gray-400 mt-1">Let muscles recover while staying active</div>
                </>
              )}
            </div>
            {plan.today_done && (
              <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-xl">✓</div>
            )}
          </div>
        </div>
      )}

      {/* Running tracker */}
      {progressiveRuns >= 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">🏃 Running Progress</div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-gray-400">Runs completed</div>
              <div className="text-3xl font-black text-blue-400">{progressiveRuns}</div>
            </div>
            <div className="w-px h-10 bg-gray-700" />
            <div className="flex-1">
              <div className="text-sm text-gray-400">Next run target</div>
              <div className="text-3xl font-black text-white">{plan?.day_type === 'running' ? plan.target_distance_km : nextRunKm} <span className="text-base font-normal text-gray-400">km</span></div>
            </div>
            <div className="w-px h-10 bg-gray-700" />
            <div className="flex-1">
              <div className="text-sm text-gray-400">Final goal</div>
              <div className="text-3xl font-black text-emerald-400">11+ <span className="text-base font-normal text-gray-400">km</span></div>
            </div>
          </div>
          {/* Mini progression bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>3.0 km</span><span>11+ km</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((progressiveRuns / 15) * 100, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Weekly calendar — click week to see it */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Week {displayWeek}</div>
          <div className="flex gap-1">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
              <button key={w} onClick={() => setActiveWeek(w)}
                className={`w-6 h-6 rounded text-xs font-bold transition-all ${w === displayWeek ? 'bg-emerald-600 text-white' : w === currentWeek ? 'bg-gray-700 text-emerald-400 ring-1 ring-emerald-600' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="text-[10px] text-center text-gray-600">{d}</div>
          ))}
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 gap-1">
          {(weeks[displayWeek - 1] || []).map(day => {
            const s  = dayTypeStyle(day.day_type);
            const isToday = day.day === currentDay;
            return (
              <div key={day.day}
                className={`rounded-xl border p-1.5 flex flex-col items-center gap-0.5 transition-all
                  ${day.status === 'completed' ? 'bg-emerald-900/40 border-emerald-700' :
                    day.status === 'missed'    ? 'bg-red-900/30 border-red-800' :
                    isToday                    ? `${s.color} ring-2 ring-white/30` :
                                                 s.color}
                `}>
                <div className={`text-[9px] font-bold ${isToday ? 'text-white' : 'text-gray-500'}`}>{day.day}</div>
                <div className="text-base">
                  {day.status === 'completed' ? '✓' : day.status === 'missed' ? '✗' : s.icon}
                </div>
                <div className={`text-[8px] font-medium ${s.text} leading-tight text-center`}>
                  {day.status === 'completed' ? 'done' : day.status === 'missed' ? 'missed' : s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 60-day dot grid */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">60-Day Grid</div>
        <div className="grid grid-cols-10 gap-1">
          {grid.map(day => {
            const s = dayTypeStyle(day.day_type);
            const isToday = day.day === currentDay;
            return (
              <div key={day.day}
                title={`Day ${day.day} · ${s.label} · ${day.status}`}
                className={`aspect-square rounded-md flex items-center justify-center text-[9px] font-bold cursor-default transition-all
                  ${day.status === 'completed' ? 'bg-emerald-600 text-white' :
                    day.status === 'missed'    ? 'bg-red-900 text-red-400 border border-red-800' :
                    isToday                    ? `${s.color} ring-2 ring-white/40` :
                                                 s.color}
                `}>
                {day.status === 'completed' ? '✓' : day.status === 'missed' ? '✗' : day.day_type === 'recovery_run' ? '🧘' : day.day_type === 'running' ? '🏃' : day.day}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600 inline-block"/>{completedDays} done</span>
          <span className="flex items-center gap-1"><span className="text-orange-400">💪</span> Strength</span>
          <span className="flex items-center gap-1"><span className="text-blue-400">🏃</span> Run</span>
          <span className="flex items-center gap-1"><span className="text-purple-400">🧘</span> Recovery</span>
        </div>
      </div>

      {/* Daily routine */}
      {status?.schedule?.wake_time && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">📋 Daily Routine</div>
          <SchedulePreview sched={{
            bedtime:    status.schedule.bedtime,
            wake:       status.schedule.wake_time,
            coldPlunge: status.schedule.cold_plunge_time,
            train:      status.schedule.train_time,
            shower:     status.schedule.shower_time,
            medit:      status.schedule.meditate_time,
            leave:      status.schedule.work_leave_time,
            returnTime: status.schedule.return_time,
            stretch:    status.schedule.stretch_time,
          }} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProgramPage() {
  const [status,  setStatus]  = useState(null);
  const [grid,    setGrid]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState('overview'); // 'overview' | 'setup' | 'active'

  async function load() {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([getProgramStatus(), getProgramGrid()]);
      setStatus(s.data);
      setGrid(g.data.grid || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load().then(() => {}); // view will be set after load
  }, []);

  // Derive view from status once loaded
  useEffect(() => {
    if (!status) return;
    if (status.active) setView('active');
    else setView('overview');
  }, [status]);

  if (loading) return (
    <div className="flex justify-center items-center py-20">
      <Spinner />
    </div>
  );

  if (view === 'setup') return (
    <div className="px-4 py-4 max-w-2xl" style={{ paddingTop: 'max(env(safe-area-inset-top),16px)' }}>
      <SetupWizard
        status={status}
        onBack={() => setView('overview')}
        onSetupComplete={() => { load(); }}
      />
    </div>
  );

  if (view === 'active') return (
    <div className="px-4 py-4 max-w-2xl" style={{ paddingTop: 'max(env(safe-area-inset-top),16px)' }}>
      <ActiveProgram status={status} grid={grid} onReset={() => { load(); }} />
    </div>
  );

  // overview / not started
  return (
    <div className="px-4 py-4 max-w-2xl" style={{ paddingTop: 'max(env(safe-area-inset-top),16px)' }}>
      <ProgramOverview status={status} onStart={() => setView('setup')} />
    </div>
  );
}
