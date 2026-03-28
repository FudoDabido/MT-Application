'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Check, Dumbbell, Timer, Footprints, Trash2 } from 'lucide-react';
import Card from '../../../design-system/Card.jsx';
import Button from '../../../design-system/Button.jsx';
import { getEvents, createEvent, deleteEvent, getCalendarDay } from '../../../api/calendarApi.js';
import { getExercises } from '../../../api/exercisesApi.js';
import api from '../../../api/axiosClient.js';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['S','M','T','W','T','F','S'];

function ymd(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function pad(n) { return String(n).padStart(2,'0'); }

function secsToMMSS(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Year View ───────────────────────────────────────────────────────────────
function YearView({ year, onMonthClick, eventsByDate }) {
  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="grid grid-cols-3 gap-3">
        {MONTHS.map((name, mi) => {
          const monthKey = `${year}-${pad(mi+1)}`;
          const daysInMonth = new Date(year, mi+1, 0).getDate();
          const firstDay = new Date(year, mi, 1).getDay();
          const eventDays = new Set(
            Object.keys(eventsByDate)
              .filter(d => d.startsWith(monthKey))
              .map(d => parseInt(d.split('-')[2]))
          );

          return (
            <Card
              key={mi}
              onClick={() => onMonthClick(mi)}
              className="p-3 cursor-pointer active:scale-[0.97] transition-transform"
            >
              <p className="text-xs font-bold text-[var(--accent)] mb-2">{name.slice(0,3)}</p>
              <div className="grid grid-cols-7 gap-[1px]">
                {Array.from({ length: firstDay }, (_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const hasEvent = eventDays.has(d);
                  return (
                    <div key={d} className={`w-2.5 h-2.5 rounded-sm ${hasEvent ? 'bg-[var(--accent)]' : 'bg-[var(--card-2)]'}`} />
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────────
function MonthView({ year, month, onDayClick, eventsByDate, onBack }) {
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const today       = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl bg-[var(--card)] text-[var(--text-2)]">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">{MONTHS[month]} {year}</h2>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-semibold text-[var(--text-3)]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const dateStr = ymd(year, month, d);
            const hasEvent = !!eventsByDate[dateStr];
            const isToday  = dateStr === today;
            return (
              <button
                key={d}
                onClick={() => onDayClick(d)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isToday
                    ? 'bg-[var(--accent)] text-black font-bold'
                    : 'bg-[var(--card-2)] text-white active:opacity-70'
                }`}
              >
                <span className="text-xs">{d}</span>
                {hasEvent && !isToday && (
                  <div className="w-1 h-1 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Session Logger Modal ─────────────────────────────────────────────────────
function SessionModal({ date, exercises, onClose, onLogged }) {
  const [tab, setTab] = useState('sport'); // sport | strength | run
  const [saving, setSaving] = useState(false);

  // Sport session
  const [sportExId, setSportExId] = useState('');
  const [sportDuration, setSportDuration] = useState('');
  const [sportDist, setSportDist] = useState('');

  // Strength sets
  const [sets, setSets] = useState([{ exId: '', reps: '', weight: '' }]);

  // Run
  const [runDist, setRunDist] = useState('');
  const [runTime, setRunTime] = useState('');

  const cardioExs = exercises.filter(e => e.category === 'cardio');
  const strengthExs = exercises.filter(e => e.category === 'strength' && !e.is_stretching);

  async function logSport() {
    if (!sportExId) return toast.error('Select an activity');
    if (!sportDuration) return toast.error('Enter duration');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('exercise_type_id', sportExId);
      fd.append('duration_secs', parseInt(sportDuration) * 60);
      if (sportDist) fd.append('distance_km', sportDist);
      fd.append('logged_at', new Date(date + 'T12:00:00').toISOString());
      await api.post('/logs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Session logged!');
      onLogged();
      onClose();
    } catch { toast.error('Failed to log'); } finally { setSaving(false); }
  }

  async function logStrength() {
    const valid = sets.filter(s => s.exId && s.reps);
    if (!valid.length) return toast.error('Add at least one exercise');
    setSaving(true);
    try {
      for (const s of valid) {
        const fd = new FormData();
        fd.append('exercise_type_id', s.exId);
        fd.append('reps', s.reps);
        fd.append('sets', 1);
        if (s.weight) fd.append('weight_kg', s.weight);
        fd.append('logged_at', new Date(date + 'T12:00:00').toISOString());
        await api.post('/logs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      toast.success(`${valid.length} exercise(s) logged!`);
      onLogged();
      onClose();
    } catch { toast.error('Failed to log'); } finally { setSaving(false); }
  }

  async function logRun() {
    if (!runDist) return toast.error('Enter distance');
    // find a Running exercise or first cardio
    const runEx = exercises.find(e => e.name?.toLowerCase().includes('run') && e.category === 'cardio')
      || cardioExs[0];
    if (!runEx) return toast.error('No running exercise found');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('exercise_type_id', runEx.id);
      fd.append('distance_km', runDist);
      if (runTime) fd.append('duration_secs', parseInt(runTime) * 60);
      fd.append('logged_at', new Date(date + 'T12:00:00').toISOString());
      await api.post('/logs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Run logged!');
      onLogged();
      onClose();
    } catch { toast.error('Failed to log'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="relative w-full bg-[var(--bg)] rounded-t-3xl border-t border-[var(--border)] max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[var(--bg)] px-5 pt-5 pb-3 border-b border-[var(--border)] flex items-center justify-between z-10">
          <h3 className="text-base font-bold text-white">Log Session</h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-[var(--card-2)] text-[var(--text-3)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-4">
          {[
            { key: 'sport',    label: 'Sport',    Icon: Timer    },
            { key: 'strength', label: 'Strength', Icon: Dumbbell },
            { key: 'run',      label: 'Run',      Icon: Footprints },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                tab === key ? 'bg-[var(--accent)] text-black' : 'bg-[var(--card)] text-[var(--text-2)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 flex flex-col gap-3">
          {/* Sport tab */}
          {tab === 'sport' && (
            <>
              <select
                value={sportExId}
                onChange={e => setSportExId(e.target.value)}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm text-white"
              >
                <option value="">Select activity…</option>
                {cardioExs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                {strengthExs.slice(0, 10).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-[var(--text-3)] mb-1 block">Duration (min)</label>
                  <input
                    type="number"
                    value={sportDuration}
                    onChange={e => setSportDuration(e.target.value)}
                    placeholder="45"
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[var(--text-3)] mb-1 block">Distance km (opt.)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sportDist}
                    onChange={e => setSportDist(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm text-white"
                  />
                </div>
              </div>
              <Button fullWidth loading={saving} onClick={logSport}>Log Sport Session</Button>
            </>
          )}

          {/* Strength tab */}
          {tab === 'strength' && (
            <>
              {sets.map((set, idx) => (
                <div key={idx} className="bg-[var(--card)] rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-3)]">Exercise {idx+1}</span>
                    {sets.length > 1 && (
                      <button onClick={() => setSets(prev => prev.filter((_, i) => i !== idx))}
                        className="text-[var(--danger)]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    value={set.exId}
                    onChange={e => setSets(prev => prev.map((s, i) => i === idx ? {...s, exId: e.target.value} : s))}
                    className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">Select exercise…</option>
                    {strengthExs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-[var(--text-3)] mb-1 block">Reps</label>
                      <input
                        type="number"
                        value={set.reps}
                        onChange={e => setSets(prev => prev.map((s, i) => i === idx ? {...s, reps: e.target.value} : s))}
                        placeholder="12"
                        className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-[var(--text-3)] mb-1 block">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={set.weight}
                        onChange={e => setSets(prev => prev.map((s, i) => i === idx ? {...s, weight: e.target.value} : s))}
                        placeholder="0"
                        className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setSets(prev => [...prev, { exId: '', reps: '', weight: '' }])}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-3)] text-sm"
              >
                <Plus className="w-4 h-4" /> Add Exercise
              </button>
              <Button fullWidth loading={saving} onClick={logStrength}>Log {sets.filter(s=>s.exId&&s.reps).length} Exercise(s)</Button>
            </>
          )}

          {/* Run tab */}
          {tab === 'run' && (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-[var(--text-3)] mb-1 block">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={runDist}
                    onChange={e => setRunDist(e.target.value)}
                    placeholder="5.0"
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[var(--text-3)] mb-1 block">Time (min)</label>
                  <input
                    type="number"
                    value={runTime}
                    onChange={e => setRunTime(e.target.value)}
                    placeholder="25"
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm text-white"
                  />
                </div>
              </div>
              {runDist && runTime && (
                <div className="text-center text-sm text-[var(--text-2)]">
                  Pace: {(parseInt(runTime) / parseFloat(runDist)).toFixed(2)} min/km
                </div>
              )}
              <Button fullWidth loading={saving} onClick={logRun}>Log Run</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────
function EventModal({ date, onClose, onSaved }) {
  const [title, setTitle]   = useState('');
  const [time, setTime]     = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error('Enter a title');
    setSaving(true);
    try {
      await createEvent({ title, date, time: time || null, event_type: 'appointment' });
      toast.success('Event saved!');
      onSaved();
      onClose();
    } catch { toast.error('Failed to save event'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="relative w-full bg-[var(--bg)] rounded-t-3xl border-t border-[var(--border)] p-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Add Event</h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-[var(--card-2)] text-[var(--text-3)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Event title…"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm text-white"
          />
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm text-white"
          />
          <Button fullWidth loading={saving} onClick={save}>Save Event</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayView({ year, month, day, exercises, onBack, onRefresh }) {
  const date = ymd(year, month, day);
  const [dayData, setDayData] = useState(null);
  const [showSession, setShowSession] = useState(false);
  const [showEvent, setShowEvent]     = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCalendarDay(date);
      setDayData(res.data);
    } catch { setDayData(null); }
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const events = dayData?.events || [];

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl bg-[var(--card)] text-[var(--text-2)]">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">
          {MONTHS[month].slice(0,3)} {day}, {year}
        </h2>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" className="flex-1" onClick={() => setShowSession(true)}>
          <Plus className="w-4 h-4" /> Log Session
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowEvent(true)}>
          <Plus className="w-4 h-4" /> Add Event
        </Button>
      </div>

      {/* Events */}
      {loading ? (
        <div className="h-24 bg-[var(--card)] rounded-2xl animate-pulse" />
      ) : events.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Events</p>
          {events.map(ev => (
            <Card key={ev.id} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{ev.title}</p>
                {ev.time && <p className="text-xs text-[var(--text-3)]">{ev.time}</p>}
              </div>
              <button
                onClick={async () => { await deleteEvent(ev.id); load(); onRefresh(); }}
                className="p-1.5 text-[var(--text-3)] active:text-[var(--danger)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center py-6 gap-2 text-center">
          <p className="text-[var(--text-3)] text-sm">No events for this day.</p>
        </Card>
      )}

      {/* Workout logs for this date */}
      {dayData?.workout_logs?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Sessions</p>
          {dayData.workout_logs.map(log => (
            <Card key={log.id} className="flex items-center gap-3">
              <Dumbbell className="w-5 h-5 text-[var(--accent)] shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{log.exercise_name || 'Exercise'}</p>
                <p className="text-xs text-[var(--text-3)]">
                  {log.reps ? `${log.reps} reps` : ''}
                  {log.weight_kg ? ` · ${log.weight_kg}kg` : ''}
                  {log.distance_km ? ` · ${log.distance_km}km` : ''}
                  {log.duration_secs ? ` · ${secsToMMSS(log.duration_secs)}` : ''}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showSession && (
        <SessionModal date={date} exercises={exercises} onClose={() => setShowSession(false)} onLogged={load} />
      )}
      {showEvent && (
        <EventModal date={date} onClose={() => setShowEvent(false)} onSaved={() => { load(); onRefresh(); }} />
      )}
    </div>
  );
}

// ─── Main Chess Board Page ────────────────────────────────────────────────────
export default function ChessBoardPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [view,  setView]  = useState('year'); // year | month | day
  const [month, setMonth] = useState(now.getMonth());
  const [day,   setDay]   = useState(now.getDate());
  const [eventsByDate, setEventsByDate] = useState({});
  const [exercises, setExercises] = useState([]);

  const loadEvents = useCallback(async () => {
    try {
      // Load all 12 months of events for year view
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, mi) =>
          getEvents(`${year}-${pad(mi+1)}`)
        )
      );
      const map = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          (r.value.data || []).forEach(ev => {
            map[ev.date] = (map[ev.date] || 0) + 1;
          });
        }
      });
      setEventsByDate(map);
    } catch {}
  }, [year]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { getExercises().then(r => setExercises(r.data || [])).catch(() => {}); }, []);

  return (
    <div className="flex flex-col gap-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        {view === 'year' ? (
          <>
            <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-xl bg-[var(--card)] text-[var(--text-2)]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-black text-white">{year}</h1>
            <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-xl bg-[var(--card)] text-[var(--text-2)]">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        ) : (
          <h1 className="text-xl font-black text-white">Chess Board</h1>
        )}
      </div>

      {/* View routing */}
      {view === 'year' && (
        <YearView
          year={year}
          eventsByDate={eventsByDate}
          onMonthClick={mi => { setMonth(mi); setView('month'); }}
        />
      )}
      {view === 'month' && (
        <MonthView
          year={year}
          month={month}
          eventsByDate={eventsByDate}
          onBack={() => setView('year')}
          onDayClick={d => { setDay(d); setView('day'); }}
        />
      )}
      {view === 'day' && (
        <DayView
          year={year}
          month={month}
          day={day}
          exercises={exercises}
          onBack={() => setView('month')}
          onRefresh={loadEvents}
        />
      )}

      <div className="h-4" />
    </div>
  );
}
