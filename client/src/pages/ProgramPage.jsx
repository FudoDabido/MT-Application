import React, { useEffect, useState } from 'react';
import { getProgramStatus, generatePreview, setupProgram, getProgramGrid, resetProgram } from '../api/programApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/shared/Button.jsx';
import Spinner from '../components/shared/Spinner.jsx';
import Input from '../components/shared/Input.jsx';

const STATUS_COLORS = {
  completed: 'bg-emerald-600 text-white',
  missed: 'bg-red-900 text-red-300 border border-red-800',
  today: 'bg-emerald-900 border-2 border-emerald-400 text-emerald-300',
  future: 'bg-gray-800 text-gray-600',
};
const PHASE_COLORS = ['text-blue-400', 'text-purple-400', 'text-orange-400', 'text-pink-400'];
const PHASE_BG = ['bg-blue-950 border-blue-800', 'bg-purple-950 border-purple-800', 'bg-orange-950 border-orange-800', 'bg-pink-950 border-pink-800'];
const SLOT_ICONS = { push: '💪', pull: '🔄', legs: '🦵', core: '⚡' };

// ── Time helpers ──────────────────────────────────────────────────────────────
function addMins(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function fmt(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function calcSchedule(leaveTime, returnTime) {
  if (!leaveTime) return null;
  const wake            = addMins(leaveTime, -(2 * 60 + 40));
  const train           = wake;
  const shower          = addMins(wake, 120);
  const meditate_morn   = addMins(shower, 15);
  const bedtime         = addMins(wake, -(8 * 60));
  // Evening (backwards from bedtime)
  const meditate_eve    = addMins(bedtime, -75);   // 1h meditate + 15min wind-down
  const stretch         = addMins(bedtime, -105);  // 30min stretch before meditate
  return { wake, train, shower, meditate_morn, leave: leaveTime, returnTime, stretch, meditate_eve, bedtime };
}

// ── Full Day Schedule Preview ─────────────────────────────────────────────────
function SchedulePreview({ sched }) {
  if (!sched) return null;

  const morningRows = [
    { icon: '🌙', label: 'Bedtime (prev. night)', time: sched.bedtime || sched.bedtime, note: '8h sleep', dim: true },
    { icon: '⏰', label: 'Wake up', time: sched.wake || sched.wake_time, note: '' },
    { icon: '💪', label: 'Start training', time: sched.train || sched.train_time, note: '2 hours' },
    { icon: '🚿', label: 'Shower & prep', time: sched.shower || sched.shower_time, note: '15 min' },
    { icon: '🧘', label: 'Morning meditate', time: sched.meditate_morn || sched.meditate_time, note: '15 min' },
    { icon: '🚶', label: 'Leave for work', time: sched.leave || sched.work_leave_time, note: '' },
  ];

  const eveningRows = [
    { icon: '🏠', label: 'Return from work', time: sched.returnTime || sched.return_time, note: '' },
    { icon: '🤸', label: 'Evening stretch', time: sched.stretch || sched.stretch_time, note: '30 min' },
    { icon: '🧘', label: 'Meditate (1 hour)', time: sched.meditate_eve || sched.meditate_eve_time, note: 'Timer + presence check' },
    { icon: '💤', label: 'Bedtime', time: sched.bedtime, note: '' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Morning block */}
      <div>
        <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-2 px-1">🌅 Morning Routine</div>
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          {morningRows.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i < morningRows.length - 1 ? 'border-b border-gray-700' : ''} ${r.dim ? 'opacity-60' : ''}`}>
              <span className="text-lg w-6 text-center">{r.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{r.label}</div>
                {r.note && <div className="text-xs text-gray-500">{r.note}</div>}
              </div>
              <div className="text-sm font-bold text-emerald-400">{fmt(r.time)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Evening block */}
      <div>
        <div className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-2 px-1">🌆 Evening Routine</div>
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          {eveningRows.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i < eveningRows.length - 1 ? 'border-b border-gray-700' : ''}`}>
              <span className="text-lg w-6 text-center">{r.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{r.label}</div>
                {r.note && <div className="text-xs text-gray-500">{r.note}</div>}
              </div>
              <div className="text-sm font-bold text-purple-400">{fmt(r.time)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Phase Card ────────────────────────────────────────────────────────────────
function PhaseCard({ phase, isCurrent }) {
  const color = PHASE_COLORS[(phase.phase - 1) % 4];
  const bg = PHASE_BG[(phase.phase - 1) % 4];
  return (
    <div className={`rounded-xl border p-4 ${bg} ${isCurrent ? 'ring-2 ring-emerald-400' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className={`text-sm font-bold ${color}`}>Phase {phase.phase}</span>
          {isCurrent && <span className="ml-2 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">CURRENT</span>}
        </div>
        <div className="text-xs text-gray-400">Days {phase.day_start}–{phase.day_end}</div>
      </div>
      <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
        <span className="text-yellow-400 font-bold">Wk1: 100 reps</span>
        <span>→</span>
        <span className="text-orange-400 font-bold">Wk2: 150 reps</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {phase.exercises.map(ex => (
          <div key={ex.id} className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2 py-1.5">
            <span className="text-base">{SLOT_ICONS[ex.slot] || '🏋️'}</span>
            <div>
              <div className="text-xs font-medium text-white leading-tight">{ex.name}</div>
              <div className="text-[10px] text-gray-500 capitalize">{ex.muscle_group?.replace('_', ' ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────
function SetupWizard({ onSetupComplete }) {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1); // 1=schedule, 2=measurements, 3=preview
  const [leaveTime, setLeaveTime] = useState('08:00');
  const [returnTime, setReturnTime] = useState('17:30');
  const [weight, setWeight] = useState(user?.initial_weight || '');
  const [height, setHeight] = useState(user?.initial_height || '');
  const [phases, setPhases] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sched = calcSchedule(leaveTime, returnTime);

  async function handlePreview() {
    setLoading(true); setError('');
    try {
      const res = await generatePreview();
      setPhases(res.data.phases);
      setStep(3);
    } catch {
      setError('Failed to generate program. Complete equipment setup first.');
    } finally { setLoading(false); }
  }

  async function handleStart() {
    setSaving(true); setError('');
    try {
      const res = await setupProgram({
        start_weight: parseFloat(weight) || null,
        start_height: parseFloat(height) || null,
        work_leave_time: leaveTime,
        return_time: returnTime,
      });
      await refreshUser();
      onSetupComplete(res.data);
    } catch {
      setError('Failed to start program.');
    } finally { setSaving(false); }
  }

  const STEPS = ['Schedule', 'Measurements', 'Your plan'];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="bg-gray-900 rounded-xl p-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((label, i) => {
            const s = i + 1;
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step >= s ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-gray-600 text-gray-500'}`}>{s}</div>
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
            <p className="text-gray-400 text-sm mb-5">Enter your work hours and we'll calculate your full daily routine — morning and evening.</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Leave for work</label>
                <input
                  type="time"
                  value={leaveTime}
                  onChange={e => setLeaveTime(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Return from work</label>
                <input
                  type="time"
                  value={returnTime}
                  onChange={e => setReturnTime(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {sched && (
              <>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your calculated routine</div>
                <SchedulePreview sched={sched} />
                <p className="text-xs text-gray-500 mt-3">
                  Bedtime = 8 hours before wake-up · Train 2h · Shower 15min · Morning meditate 15min · Evening: 30min stretch → 1h meditation → bed
                </p>
              </>
            )}

            <Button onClick={() => setStep(2)} className="w-full mt-5">Looks good → Next</Button>
          </>
        )}

        {/* Step 2: Measurements */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Starting Measurements</h2>
            <p className="text-gray-400 text-sm mb-5">Record your starting point to track progress over 60 days.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Input label="Starting Weight (kg)" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 80.5" />
              <Input label="Starting Height (cm)" type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 175" />
            </div>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={handlePreview} disabled={loading} className="flex-1">
                {loading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Generating...</span> : 'Generate My 60-Day Plan →'}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Preview */}
        {step === 3 && phases && (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Your 60-Day Training Plan</h2>
            <p className="text-gray-400 text-sm mb-4">4 exercises per phase · rotates every 14 days</p>
            <div className="flex flex-col gap-3 mb-5">
              {phases.map(phase => <PhaseCard key={phase.phase} phase={phase} isCurrent={false} />)}
            </div>
            <div className="bg-gray-800 rounded-lg p-3 mb-5 text-sm text-gray-300">
              <div className="font-semibold text-white mb-1">Daily target:</div>
              <div className="flex gap-4 text-sm flex-wrap">
                <span>📅 Week 1: <span className="text-yellow-400 font-bold">100 reps</span> × 4 exercises</span>
                <span>📈 Week 2: <span className="text-orange-400 font-bold">150 reps</span> × 4 exercises</span>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={handleStart} disabled={saving} className="flex-1">
                {saving ? 'Starting...' : '🚀 Start 60-Day Program'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Today's Workout ───────────────────────────────────────────────────────────
function TodayWorkout({ plan }) {
  if (!plan || !plan.exercises) return null;
  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Today's Workout</h2>
          <div className="text-xs text-gray-500 mt-0.5">Phase {plan.phase_number} · Day {plan.day_in_phase} of 14 · Week {plan.week_in_phase}</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black ${plan.week_in_phase === 1 ? 'text-yellow-400' : 'text-orange-400'}`}>{plan.target_reps}</div>
          <div className="text-xs text-gray-500">reps each</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {plan.exercises.map(ex => (
          <div key={ex.id} className="bg-gray-800 rounded-lg p-3 flex items-center gap-2">
            <span className="text-xl">{SLOT_ICONS[ex.slot] || '🏋️'}</span>
            <div>
              <div className="text-sm font-medium text-white">{ex.name}</div>
              <div className="text-xs text-gray-500">{plan.target_reps} reps · {ex.muscle_group?.replace('_', ' ')}</div>
            </div>
          </div>
        ))}
      </div>
      {plan.today_done ? (
        <div className="mt-3 bg-emerald-900/40 text-emerald-300 rounded-lg px-4 py-2 text-sm text-center font-medium">✓ Today's workout logged!</div>
      ) : (
        <div className="mt-3 bg-yellow-900/30 text-yellow-300 rounded-lg px-4 py-2 text-sm text-center">⚡ Log your workout to keep your streak!</div>
      )}
    </div>
  );
}

// ── Daily Routine Card (active program) ───────────────────────────────────────
function DailyRoutineCard({ schedule }) {
  if (!schedule || !schedule.wake_time) return null;
  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Daily Routine</h2>
      <SchedulePreview sched={schedule} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProgramPage() {
  const [status, setStatus] = useState(null);
  const [grid, setGrid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([getProgramStatus(), getProgramGrid()]);
      setStatus(s.data);
      setGrid(g.data.grid || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleReset() {
    setResetting(true);
    try {
      await resetProgram();
      setConfirmReset(false);
      await load();
    } catch (err) { console.error(err); }
    finally { setResetting(false); }
  }

  function handleSetupComplete() {
    setShowSetup(false);
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  if (showSetup || (status?.active && !status?.has_setup)) {
    return <SetupWizard onSetupComplete={handleSetupComplete} />;
  }

  const completedDays = grid.filter(d => d.status === 'completed').length;
  const pct = Math.round((completedDays / 60) * 100);

  const phaseMap = {};
  grid.forEach(d => {
    if (d.phase && !phaseMap[d.phase]) {
      phaseMap[d.phase] = { phase: d.phase, day_start: d.day, day_end: d.day, exercises: d.exercises };
    } else if (d.phase) {
      phaseMap[d.phase].day_end = d.day;
    }
  });
  const phases = Object.values(phaseMap);
  const currentPhase = status?.today_plan?.phase_number;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">60-Day Program</h1>
          <p className="text-gray-400 text-sm mt-1">100 reps × 4 exercises · every day · miss one = back to Day 1</p>
        </div>
        {/* Reset button (active program) */}
        {status?.active && !confirmReset && (
          <button
            onClick={() => setConfirmReset(true)}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors mt-1"
          >
            Reset program
          </button>
        )}
        {confirmReset && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Are you sure?</span>
            <button onClick={handleReset} disabled={resetting} className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors">
              {resetting ? '...' : 'Yes, reset'}
            </button>
            <button onClick={() => setConfirmReset(false)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
          </div>
        )}
      </div>

      {/* Not started */}
      {!status?.active && (
        <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center gap-4">
          {status?.failure && (
            <div className="bg-red-900/40 text-red-300 rounded-lg px-4 py-3 text-sm w-full text-center">
              You missed Day {status.failure.failedOnDay} ({status.failure.failedDate}). Program reset. {status.total_tries > 0 && `Try #${status.total_tries + 1} ready.`}
            </div>
          )}
          <div className="text-center text-gray-400 max-w-md">
            {status?.total_tries > 0
              ? `${status.total_tries} attempt${status.total_tries !== 1 ? 's' : ''} so far. You've got this.`
              : 'A structured 60-day plan built around your equipment. Train every day to keep your streak.'}
          </div>
          <Button onClick={() => setShowSetup(true)} className="px-8 py-3 text-base">
            {status?.total_tries > 0 ? `Start Try #${status.total_tries + 1}` : 'Start 60-Day Program'}
          </Button>
        </div>
      )}

      {/* Active program */}
      {status?.active && (
        <>
          {/* Starts tomorrow banner */}
          {status.starts_tomorrow && (
            <div className="bg-emerald-900/40 border border-emerald-700 rounded-xl p-5 text-center">
              <div className="text-3xl mb-2">🌅</div>
              <div className="text-emerald-300 font-bold text-lg mb-1">Day 1 starts tomorrow!</div>
              <div className="text-gray-400 text-sm">
                Your program is ready. Get a good night's sleep — training begins{' '}
                <span className="text-white font-semibold">{fmt(status.schedule?.wake_time)} tomorrow</span>.
              </div>
              <div className="text-xs text-gray-500 mt-2">Start date: {status.start_date}</div>
            </div>
          )}

          {/* Progress bar */}
          {!status.starts_tomorrow && <div className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-4xl font-black text-emerald-400">Day {status.current_day}</div>
                <div className="text-gray-400 text-sm mt-0.5">Try #{status.try_number} · Phase {status.today_plan?.phase_number || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{pct}%</div>
                <div className="text-xs text-gray-500">{completedDays}/60 days</div>
              </div>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>}

          {/* Today's workout */}
          {!status.starts_tomorrow && status.today_plan && <TodayWorkout plan={status.today_plan} />}

          {/* Daily Routine */}
          {status.schedule && <DailyRoutineCard schedule={status.schedule} />}

          {/* Phase overview */}
          {phases.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Training Phases</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {phases.map(phase => (
                  <PhaseCard key={phase.phase} phase={phase} isCurrent={phase.phase === currentPhase} />
                ))}
              </div>
            </div>
          )}

          {/* 60-day grid */}
          {grid.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Progress Grid</h2>
              <div className="grid grid-cols-10 gap-1">
                {grid.map((day) => (
                  <div
                    key={day.day}
                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-all cursor-default ${STATUS_COLORS[day.status]}`}
                    title={`Day ${day.day} · ${day.date} · Phase ${day.phase} · ${day.target_reps} reps · ${day.status}`}
                  >
                    {day.status === 'completed' ? '✓' : day.status === 'missed' ? '✗' : day.day}
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Done</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900 inline-block" /> Missed</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-emerald-400 bg-emerald-900 inline-block" /> Today</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-800 inline-block" /> Future</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
