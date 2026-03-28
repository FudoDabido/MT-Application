'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getCalendarMonth, getEvents, createEvent, updateEvent, deleteEvent } from '../api/calendarApi.js';
import { getScheduleDay, upsertScheduleDay, deleteScheduleDay, createTodo, updateTodo, deleteTodo } from '../api/scheduleApi.js';
import { getDailyScores } from '../api/usersApi.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_HDR   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

const SCHEDULE_ROWS = [
  { key: 'bedtime',       label: 'Bedtime (prev. night)', icon: '🌙', dim: true, note: '8h before wake-up' },
  { key: 'wake_time',     label: 'Wake up',               icon: '⏰' },
  { key: 'train_time',    label: 'Train',                 icon: '💪', note: '1 hour' },
  { key: 'shower_time',   label: 'Shower & prep',         icon: '🚿', note: '15 min' },
  { key: 'meditate_time', label: 'Meditate',              icon: '🧘', note: '1 hour' },
  { key: 'leave_time',    label: 'Leave for work',        icon: '🚶', isUserTime: true },
  { key: 'return_time',   label: 'Return home',           icon: '🏠', isUserTime: true },
  { key: 'stretch_time',  label: 'Evening stretch',       icon: '🤸', note: '30 min' },
  { key: 'bedtime_end',   label: 'Bedtime',               icon: '💤' },
];

const COLORS = {
  emerald: { dot: 'bg-emerald-500', badge: 'bg-emerald-900/60 text-emerald-300', picker: 'bg-emerald-500' },
  blue:    { dot: 'bg-blue-500',    badge: 'bg-blue-900/60 text-blue-300',        picker: 'bg-blue-500' },
  purple:  { dot: 'bg-purple-500',  badge: 'bg-purple-900/60 text-purple-300',    picker: 'bg-purple-500' },
  orange:  { dot: 'bg-orange-500',  badge: 'bg-orange-900/60 text-orange-300',    picker: 'bg-orange-500' },
  red:     { dot: 'bg-red-500',     badge: 'bg-red-900/60 text-red-300',          picker: 'bg-red-500' },
  yellow:  { dot: 'bg-yellow-400',  badge: 'bg-yellow-900/60 text-yellow-300',    picker: 'bg-yellow-400' },
};
const REPEAT_LABELS = { none:'No repeat', daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' };
const REMIND_OPTS   = [
  { value:0,    label:'No reminder' },
  { value:15,   label:'15 min before' },
  { value:30,   label:'30 min before' },
  { value:60,   label:'1 hour before' },
  { value:1440, label:'1 day before' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmt12(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function fmtDur(mins) {
  if (!mins) return '';
  const h = Math.floor(mins/60), m = mins%60;
  return m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
function dayLabel(ds) {
  const today    = toYMD(new Date());
  const tomorrow = toYMD(new Date(Date.now()+86400000));
  if (ds===today)    return 'Today';
  if (ds===tomorrow) return 'Tomorrow';
  return new Date(ds+'T12:00:00').toLocaleDateString('default',{weekday:'long',month:'long',day:'numeric'});
}

// ── Event Form ────────────────────────────────────────────────────────────────
function EventForm({ initialDate, event, onSave, onCancel, onDelete }) {
  const [title,    setTitle]    = useState(event?.title || '');
  const [date,     setDate]     = useState(event?.date  || initialDate);
  const [time,     setTime]     = useState(event?.time  || '');
  const [duration, setDuration] = useState(event?.duration_mins || '');
  const [notes,    setNotes]    = useState(event?.notes || '');
  const [color,    setColor]    = useState(event?.color || 'emerald');
  const [repeat,   setRepeat]   = useState(event?.repeat_type || 'none');
  const [remind,   setRemind]   = useState(event?.remind_mins ?? 0);
  const [saving,   setSaving]   = useState(false);
  const [confirmDel, setConfirm] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), date, time: time||null,
        duration_mins: duration ? parseInt(duration) : null,
        notes: notes.trim()||null, color, remind_mins: remind, repeat_type: repeat });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3"
      onClick={onCancel}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
          <h2 className="text-base font-black text-white">{event ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3 max-h-[65vh] overflow-y-auto">
          <input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Event title *"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Time (optional)</label>
              <input type="time" value={time} onChange={e=>setTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Duration (minutes)</label>
            <input type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="e.g. 60"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Repeat</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(REPEAT_LABELS).map(([v,l]) => (
                <button key={v} onClick={()=>setRepeat(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    repeat===v ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Reminder</label>
            <select value={remind} onChange={e=>setRemind(parseInt(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500">
              {REMIND_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Color</label>
            <div className="flex gap-2">
              {Object.keys(COLORS).map(c=>(
                <button key={c} onClick={()=>setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${COLORS[c].picker} ${color===c?'ring-2 ring-offset-2 ring-offset-gray-900 ring-white scale-110':'opacity-60 hover:opacity-100'}`} />
              ))}
            </div>
          </div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none" />
        </div>
        <div className="px-5 pb-5 pt-2 flex gap-2 border-t border-gray-800">
          {event && (
            <button onClick={() => confirmDel ? onDelete() : setConfirm(true)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                confirmDel ? 'bg-red-600 text-white' : 'bg-gray-800 text-red-400 hover:bg-gray-700'}`}>
              {confirmDel ? 'Confirm' : 'Delete'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving||!title.trim()}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black rounded-xl text-sm transition-colors">
            {saving ? 'Saving…' : event ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Todo item ─────────────────────────────────────────────────────────────────
function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div className={`flex items-center gap-3 px-2 py-2 rounded-xl group transition-colors ${todo.completed?'opacity-50':'hover:bg-gray-800/60'}`}>
      <button onClick={()=>onToggle(todo)}
        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
          todo.completed ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600 hover:border-emerald-400'}`}>
        {todo.completed && <span className="text-white text-[10px]">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${todo.completed?'line-through text-gray-500':'text-gray-200'}`}>{todo.text}</span>
        {todo.remind_at && <span className="block text-xs text-gray-600 mt-0.5">⏰ {fmt12(todo.remind_at)}</span>}
      </div>
      <button onClick={()=>onDelete(todo.id)}
        className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm p-1 shrink-0">✕</button>
    </div>
  );
}

// ── Day detail panel (schedule + todos + events) ──────────────────────────────
function DayPanel({ date, monthEvents, onEventSaved }) {
  const [schedData,   setSchedData]   = useState(null);
  const [schedLoad,   setSchedLoad]   = useState(true);
  const [editMode,    setEditMode]    = useState(false);
  const [editVals,    setEditVals]    = useState({});
  const [saving,      setSaving]      = useState(false);

  // todos
  const [addingTodo,  setAddingTodo]  = useState(false);
  const [todoText,    setTodoText]    = useState('');
  const [todoRemind,  setTodoRemind]  = useState('');
  const [todoSaving,  setTodoSaving]  = useState(false);
  const todoInputRef = useRef(null);

  // events
  const [showEvForm,  setShowEvForm]  = useState(false);
  const [editingEv,   setEditingEv]   = useState(null);

  const dayEvs = monthEvents.filter(e => e.date === date);

  async function loadSched() {
    setSchedLoad(true);
    try { const r = await getScheduleDay(date); setSchedData(r.data); }
    catch {}
    finally { setSchedLoad(false); }
  }

  useEffect(() => { loadSched(); setEditMode(false); setAddingTodo(false); }, [date]);

  async function handleSaveTimes() {
    setSaving(true);
    try {
      await upsertScheduleDay(date, { leave_time: editVals.leave_time||null, return_time: editVals.return_time||null });
      await loadSched();
      setEditMode(false);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleResetTimes() {
    setSaving(true);
    try { await deleteScheduleDay(date); await loadSched(); setEditMode(false); }
    catch(e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleAddTodo() {
    if (!todoText.trim()) return;
    setTodoSaving(true);
    try {
      await createTodo({ date, text: todoText.trim(), remind_at: todoRemind||null });
      setTodoText(''); setTodoRemind(''); setAddingTodo(false);
      await loadSched();
    } catch(e) { console.error(e); }
    finally { setTodoSaving(false); }
  }

  async function handleToggleTodo(todo) {
    try { await updateTodo(todo.id, { completed: todo.completed ? 0 : 1 }); await loadSched(); }
    catch(e) { console.error(e); }
  }

  async function handleDeleteTodo(id) {
    try { await deleteTodo(id); await loadSched(); } catch(e) { console.error(e); }
  }

  async function handleSaveEvent(data) {
    if (editingEv) await updateEvent(editingEv.id, data);
    else           await createEvent(data);
    setShowEvForm(false); setEditingEv(null);
    onEventSaved();
  }

  async function handleDeleteEvent() {
    if (!editingEv) return;
    await deleteEvent(editingEv.id);
    setShowEvForm(false); setEditingEv(null);
    onEventSaved();
  }

  const sched  = schedData?.schedule ?? {};
  const todos  = schedData?.todos ?? [];
  const pending = todos.filter(t => !t.completed);
  const done    = todos.filter(t => t.completed);
  const hasSchedule = schedData?.has_default || schedData?.leave_time;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Section: Schedule ── */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Daily Schedule</span>
          {!editMode && hasSchedule && !schedLoad && (
            <button onClick={() => { setEditVals({ leave_time: schedData?.leave_time||'', return_time: schedData?.return_time||'' }); setEditMode(true); }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">Edit times</button>
          )}
          {editMode && (
            <div className="flex items-center gap-2">
              {schedData?.is_custom && (
                <button onClick={handleResetTimes} disabled={saving} className="text-xs text-gray-500 hover:text-red-400">Reset</button>
              )}
              <button onClick={()=>setEditMode(false)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSaveTimes} disabled={saving}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg">
                {saving ? '…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {schedLoad ? (
          <div className="py-6 text-center text-gray-600 text-sm">Loading…</div>
        ) : !hasSchedule ? (
          <div className="px-4 py-5 text-center">
            <p className="text-gray-500 text-sm">No schedule for this day.</p>
            <p className="text-gray-600 text-xs mt-1">Set up your 60-day program or edit leave time to generate a schedule.</p>
            <button onClick={() => { setEditVals({ leave_time:'', return_time:'' }); setEditMode(true); }}
              className="mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-emerald-400 text-xs font-semibold rounded-lg transition-colors">
              Set leave time →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {SCHEDULE_ROWS.map((row, i) => {
              let time;
              if (row.key === 'leave_time')   time = schedData?.leave_time;
              else if (row.key === 'return_time') time = schedData?.return_time;
              else if (row.key === 'bedtime_end') time = sched.bedtime;
              else time = sched[row.key];

              return (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${row.dim ? 'opacity-50' : ''} ${row.isUserTime ? 'bg-gray-800/40' : ''}`}>
                  <span className="text-base w-6 text-center shrink-0">{row.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-200">{row.label}</span>
                    {row.note && <span className="text-xs text-gray-600 ml-1.5">{row.note}</span>}
                  </div>
                  {editMode && row.isUserTime ? (
                    <input type="time" value={editVals[row.key]||''} onChange={e=>setEditVals(p=>({...p,[row.key]:e.target.value}))}
                      className="bg-gray-700 text-white text-sm px-2 py-1 rounded-lg border border-gray-600 focus:border-emerald-500 outline-none" />
                  ) : (
                    <span className={`text-sm font-bold tabular-nums ${time ? 'text-white' : 'text-gray-600'}`}>{fmt12(time)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section: Tasks ── */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tasks</span>
          <button onClick={() => { setAddingTodo(a=>!a); setTimeout(()=>todoInputRef.current?.focus(),50); }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
            {addingTodo ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {addingTodo && (
          <div className="px-4 pt-3 pb-2 flex flex-col gap-2 border-b border-gray-800">
            <input ref={todoInputRef} value={todoText} onChange={e=>setTodoText(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleAddTodo()} placeholder="What needs doing?"
              className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:border-emerald-500 outline-none placeholder-gray-500" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Remind at</label>
              <input type="time" value={todoRemind} onChange={e=>setTodoRemind(e.target.value)}
                className="flex-1 bg-gray-800 text-white text-sm px-2 py-1.5 rounded-lg border border-gray-700 focus:border-emerald-500 outline-none" />
              <button onClick={handleAddTodo} disabled={todoSaving||!todoText.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors shrink-0">
                {todoSaving ? '…' : 'Add'}
              </button>
            </div>
          </div>
        )}

        <div className="px-2 py-2">
          {pending.length === 0 && done.length === 0 && !addingTodo ? (
            <p className="text-sm text-gray-600 text-center py-3">No tasks for this day.</p>
          ) : (
            <>
              {pending.map(t=><TodoItem key={t.id} todo={t} onToggle={handleToggleTodo} onDelete={handleDeleteTodo} />)}
              {done.length > 0 && (
                <>
                  {pending.length > 0 && <div className="border-t border-gray-800 my-1" />}
                  {done.map(t=><TodoItem key={t.id} todo={t} onToggle={handleToggleTodo} onDelete={handleDeleteTodo} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Section: Events ── */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Events</span>
          <button onClick={()=>{ setEditingEv(null); setShowEvForm(true); }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">+ Add</button>
        </div>

        {dayEvs.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">No events — tap + Add to create one.</p>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {dayEvs.map(ev=>(
              <button key={ev.id+'_'+ev.date} onClick={()=>{ setEditingEv(ev); setShowEvForm(true); }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${COLORS[ev.color]?.dot||'bg-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{ev.title}</div>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {ev.time && <span className="text-xs text-gray-400">{fmt12(ev.time)}</span>}
                    {ev.duration_mins && <span className="text-xs text-gray-500">{fmtDur(ev.duration_mins)}</span>}
                    {ev.repeat_type!=='none' && <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">{REPEAT_LABELS[ev.repeat_type]}</span>}
                    {ev.remind_mins>0 && <span className="text-[10px] text-yellow-500">🔔</span>}
                  </div>
                  {ev.notes && <div className="text-xs text-gray-500 truncate mt-0.5">{ev.notes}</div>}
                </div>
                <span className="text-gray-600 text-sm mt-0.5 shrink-0">›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showEvForm && (
        <EventForm initialDate={date} event={editingEv} onSave={handleSaveEvent} onDelete={handleDeleteEvent}
          onCancel={()=>{ setShowEvForm(false); setEditingEv(null); }} />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = toYMD(new Date());
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [month,        setMonth]        = useState(new Date().getMonth()+1);
  const [events,       setEvents]       = useState([]);
  const [workoutDays,  setWorkoutDays]  = useState(new Set());
  const [dayScores,    setDayScores]    = useState({});
  const [selectedDate, setSelectedDate] = useState(today);

  const yearMonth = `${year}-${String(month).padStart(2,'0')}`;

  async function loadMonth() {
    const [evRes, wRes, scRes] = await Promise.allSettled([
      getEvents(yearMonth),
      getCalendarMonth(yearMonth),
      getDailyScores(yearMonth),
    ]);
    if (evRes.status==='fulfilled') setEvents(evRes.value.data.events||[]);
    if (wRes.status==='fulfilled')  setWorkoutDays(new Set(wRes.value.data.workout_days||[]));
    if (scRes.status==='fulfilled') setDayScores(scRes.value.data.scores||{});
  }

  useEffect(() => { loadMonth(); }, [yearMonth]);

  // When selected date is in a different month, navigate to it
  function selectDate(ds) {
    setSelectedDate(ds);
    const [y, m] = ds.split('-').map(Number);
    setYear(y); setMonth(m);
  }

  function prevMonth() {
    if (month===1) { setYear(y=>y-1); setMonth(12); }
    else setMonth(m=>m-1);
  }
  function nextMonth() {
    if (month===12) { setYear(y=>y+1); setMonth(1); }
    else setMonth(m=>m+1);
  }

  // Calendar grid params
  const daysInMonth = new Date(year, month, 0).getDate();
  const rawFirst = new Date(year, month-1, 1).getDay();
  const firstOffset = rawFirst===0 ? 6 : rawFirst-1; // Mon=0

  // Group events by date for dots
  const eventsByDate = {};
  events.forEach(ev => { (eventsByDate[ev.date]??=[]).push(ev); });

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">←</button>
          <span className="text-sm font-semibold min-w-[130px] text-center">{MONTH_NAMES[month-1]} {year}</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">→</button>
        </div>
      </div>

      {/* Month grid */}
      <div className="bg-gray-900 rounded-2xl p-3">
        <div className="grid grid-cols-7 mb-1">
          {DAYS_HDR.map(d=>(
            <div key={d} className="text-center text-[11px] text-gray-600 font-semibold py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({length:firstOffset}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const ds = `${yearMonth}-${String(day).padStart(2,'0')}`;
            const isToday    = ds===today;
            const isSelected = ds===selectedDate;
            const dayEvs     = eventsByDate[ds]||[];
            const hasWorkout = workoutDays.has(ds);
            const sc = dayScores[ds];
            // Heatmap: tint based on discipline score
            const heatClass = sc
              ? sc.score >= 1   ? 'bg-emerald-900/40'
              : sc.score >= 0.75 ? 'bg-emerald-900/25'
              : sc.score > 0    ? 'bg-yellow-900/25'
              : '' : '';
            const prRing = sc?.pr ? 'ring-1 ring-yellow-500' : '';
            return (
              <button key={day} onClick={()=>selectDate(ds)}
                className={`rounded-xl p-1 min-h-[52px] flex flex-col items-start transition-all ${
                  isSelected ? 'bg-white/10 ring-2 ring-white/30' :
                  isToday    ? `bg-emerald-950 ring-1 ring-emerald-700 ${prRing}` :
                  `${heatClass} ${prRing} hover:bg-gray-800`
                }`}>
                <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                  isToday ? 'bg-emerald-500 text-black' : isSelected ? 'text-white' : 'text-gray-400'}`}>{day}</span>
                <div className="flex flex-wrap gap-0.5 px-0.5">
                  {dayEvs.slice(0,3).map((ev,i)=>(
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${COLORS[ev.color]?.dot||'bg-emerald-500'}`}/>
                  ))}
                  {hasWorkout && <span className="w-1.5 h-1.5 rounded-full bg-gray-500"/>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day label */}
      <div className="flex items-center justify-between px-1">
        <div>
          <span className="font-black text-white">{dayLabel(selectedDate)}</span>
          {selectedDate!==today && <span className="text-xs text-gray-600 ml-2">{selectedDate}</span>}
        </div>
        {selectedDate===today && (
          <button onClick={()=>selectDate(toYMD(new Date(Date.now()+86400000)))}
            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">Plan tomorrow →</button>
        )}
      </div>

      {/* Day detail: schedule + tasks + events */}
      <DayPanel date={selectedDate} monthEvents={events} onEventSaved={loadMonth} />
    </div>
  );
}
