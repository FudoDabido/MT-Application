'use client';
import React, { useState, useEffect, useRef } from 'react';
import Spinner from '../components/shared/Spinner.jsx';
import {
  getScheduleDay, upsertScheduleDay, deleteScheduleDay,
  createTodo, updateTodo, deleteTodo,
} from '../api/scheduleApi.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function fmt12(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function dayLabel(dateStr) {
  const today    = toDateStr(new Date());
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
  if (dateStr === today)    return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getScheduleItems(meditationMode) {
  const base = [
    { key: 'bedtime',       label: 'Bedtime',          icon: '🌙', note: 'Previous night' },
    { key: 'wake_time',       label: 'Wake up',    icon: '⏰' },
    { key: 'cold_plunge_time', label: 'Cold plunge', icon: '🧊' },
    { key: 'train_time',      label: 'Train',       icon: '💪' },
    { key: 'shower_time',   label: 'Shower',           icon: '🚿' },
    { key: 'meditate_time', label: meditationMode === '2x30' ? 'Meditate (morning · 30min)' : 'Meditate (1h)',  icon: '🧘' },
    { key: 'leave_time',    label: 'Leave for work',   icon: '🚶', isUserTime: true },
    { key: 'return_time',   label: 'Return home',      icon: '🏠', isUserTime: true },
    { key: 'stretch_time',  label: 'Stretch',          icon: '🤸' },
  ];
  if (meditationMode === '2x30') {
    base.push({ key: 'meditate_eve_time', label: 'Meditate (evening · 30min)', icon: '🌿' });
  }
  return base;
}

// ── Day selector ──────────────────────────────────────────────────────────────
function DaySelector({ selected, onChange }) {
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(Date.now() + (i - 1) * 86400000);
    return toDateStr(d);
  });

  const scrollRef = useRef(null);
  // scroll selected into view on mount
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  return (
    <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {days.map(date => {
        const isToday    = date === toDateStr(new Date());
        const isSelected = date === selected;
        const d = new Date(date + 'T00:00:00');
        const dow = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const dom = d.getDate();
        return (
          <button
            key={date}
            data-active={isSelected}
            onClick={() => onChange(date)}
            className={[
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0 transition-all text-xs',
              isSelected
                ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500',
            ].join(' ')}
          >
            <span className="font-semibold uppercase tracking-wide">{dow}</span>
            <span className={`text-base font-black tabular-nums ${isSelected ? 'text-emerald-400' : isToday ? 'text-white' : ''}`}>{dom}</span>
            {isToday && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-600'}`} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Schedule timeline ─────────────────────────────────────────────────────────
function ScheduleTimeline({ data, editMode, editValues, onChange }) {
  if (!data?.has_default && !data?.leave_time) {
    return (
      <div className="bg-gray-900 rounded-2xl p-5 text-center">
        <p className="text-gray-500 text-sm">No schedule set up yet.</p>
        <p className="text-gray-600 text-xs mt-1">Set up your 60-day program to see your daily schedule.</p>
      </div>
    );
  }

  const sched = data.schedule ?? {};

  return (
    <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Daily Schedule</span>
        {data.is_custom && (
          <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">Custom ⚙️</span>
        )}
      </div>

      {getScheduleItems(data?.meditation_mode || '1h_morning').map((item) => {
        const time = item.isUserTime
          ? (item.key === 'leave_time'  ? data.leave_time  : data.return_time)
          : sched[item.key];

        return (
          <div key={item.key} className={[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl',
            item.isUserTime ? 'bg-gray-800' : '',
          ].join(' ')}>
            <span className="text-lg w-7 text-center shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-200">{item.label}</span>
              {item.note && <span className="text-xs text-gray-600 ml-1">({item.note})</span>}
            </div>
            {editMode && item.isUserTime ? (
              <input
                type="time"
                value={editValues[item.key] || ''}
                onChange={e => onChange(item.key, e.target.value)}
                className="bg-gray-700 text-white text-sm px-2 py-1 rounded-lg border border-gray-600 focus:border-emerald-500 outline-none"
              />
            ) : (
              <span className={`text-sm font-bold tabular-nums ${time ? 'text-white' : 'text-gray-600'}`}>
                {fmt12(time)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Todos ─────────────────────────────────────────────────────────────────────
function TodoList({ date, todos, onUpdate }) {
  const [newText,     setNewText]     = useState('');
  const [newRemindAt, setNewRemindAt] = useState('');
  const [adding,      setAdding]      = useState(false);
  const [saving,      setSaving]      = useState(false);
  const inputRef = useRef(null);

  async function handleAdd() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      await createTodo({ date, text: newText.trim(), remind_at: newRemindAt || null });
      setNewText('');
      setNewRemindAt('');
      setAdding(false);
      onUpdate();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleToggle(todo) {
    try {
      await updateTodo(todo.id, { completed: todo.completed ? 0 : 1 });
      onUpdate();
    } catch(e) { console.error(e); }
  }

  async function handleDelete(id) {
    try {
      await deleteTodo(id);
      onUpdate();
    } catch(e) { console.error(e); }
  }

  const done    = todos.filter(t => t.completed);
  const pending = todos.filter(t => !t.completed);

  return (
    <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">To-Do</span>
        <button
          onClick={() => { setAdding(a => !a); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 p-3 bg-gray-800 rounded-xl">
          <input
            ref={inputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="What needs doing?"
            className="bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-emerald-500 outline-none placeholder-gray-500"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">Remind at</label>
            <input
              type="time"
              value={newRemindAt}
              onChange={e => setNewRemindAt(e.target.value)}
              className="flex-1 bg-gray-700 text-white text-sm px-2 py-1.5 rounded-lg border border-gray-600 focus:border-emerald-500 outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newText.trim()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-colors shrink-0"
            >
              {saving ? '…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {pending.length === 0 && done.length === 0 && !adding && (
        <p className="text-sm text-gray-600 text-center py-2">No tasks for this day.</p>
      )}

      <div className="flex flex-col gap-1">
        {pending.map(todo => (
          <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
        ))}
        {done.length > 0 && (
          <>
            {pending.length > 0 && <div className="border-t border-gray-800 my-1" />}
            {done.map(todo => (
              <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div className={`flex items-center gap-3 px-2 py-2 rounded-xl group transition-colors ${todo.completed ? 'opacity-50' : 'hover:bg-gray-800'}`}>
      <button
        onClick={() => onToggle(todo)}
        className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center ${
          todo.completed ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600 hover:border-emerald-400'
        }`}
      >
        {todo.completed && <span className="text-white text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${todo.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
          {todo.text}
        </span>
        {todo.remind_at && (
          <span className="block text-xs text-gray-600 mt-0.5">⏰ {fmt12(todo.remind_at)}</span>
        )}
      </div>
      <button
        onClick={() => onDelete(todo.id)}
        className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm p-1"
      >
        ✕
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const today = toDateStr(new Date());
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));

  const [selectedDate, setSelectedDate] = useState(today);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode,  setEditMode]  = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);

  function loadDay(date) {
    setLoading(true);
    setEditMode(false);
    getScheduleDay(date)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDay(selectedDate); }, [selectedDate]);

  function handleEditOpen() {
    setEditValues({
      leave_time:  data?.leave_time  || '',
      return_time: data?.return_time || '',
    });
    setEditMode(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await upsertScheduleDay(selectedDate, {
        leave_time:  editValues.leave_time  || null,
        return_time: editValues.return_time || null,
      });
      await loadDay(selectedDate);
      setEditMode(false);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await deleteScheduleDay(selectedDate);
      await loadDay(selectedDate);
      setEditMode(false);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  }

  const showTomorrowNudge = selectedDate === today && data && !loading;

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-2xl font-black text-white">Schedule</h1>

      <DaySelector selected={selectedDate} onChange={setSelectedDate} />

      {/* Date header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-black text-white">{dayLabel(selectedDate)}</span>
          <span className="text-sm text-gray-500 ml-2">{selectedDate}</span>
        </div>
        {!editMode && data && !loading && (
          <button
            onClick={handleEditOpen}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Edit times
          </button>
        )}
        {editMode && (
          <div className="flex items-center gap-3">
            {data?.is_custom && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Reset to default
              </button>
            )}
            <button
              onClick={() => setEditMode(false)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Tomorrow planning nudge */}
      {showTomorrowNudge && (
        <button
          onClick={() => setSelectedDate(tomorrow)}
          className="flex items-center gap-3 px-4 py-3 bg-emerald-950/60 border border-emerald-800 rounded-2xl text-left hover:border-emerald-600 transition-colors"
        >
          <span className="text-xl">📋</span>
          <div>
            <div className="text-sm font-semibold text-emerald-400">Plan tomorrow</div>
            <div className="text-xs text-gray-500">Set your schedule & tasks for tomorrow now</div>
          </div>
          <span className="text-gray-500 ml-auto">→</span>
        </button>
      )}

      {loading
        ? <div className="flex justify-center py-10"><Spinner /></div>
        : (
          <>
            <ScheduleTimeline
              data={data}
              editMode={editMode}
              editValues={editValues}
              onChange={(k, v) => setEditValues(prev => ({ ...prev, [k]: v }))}
            />
            <TodoList
              date={selectedDate}
              todos={data?.todos ?? []}
              onUpdate={() => loadDay(selectedDate)}
            />
          </>
        )
      }
    </div>
  );
}
