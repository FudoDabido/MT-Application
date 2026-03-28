'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listEntries, getEntry, upsertEntry, lockEntry, getLessons, createLesson } from '../api/diaryApi.js';

function toDateStr(d) { return d.toISOString().split('T')[0]; }
function fmtDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Daily Section ─────────────────────────────────────────────────────────────

const QUESTIONS = [
  { key: 'did_best',  label: 'Did you do your best today?',          placeholder: 'Be honest with yourself…' },
  { key: 'what_did',  label: 'What did you do today?',               placeholder: 'Walk through your day…' },
  { key: 'proud',     label: 'Are you proud of yourself?',           placeholder: 'What are you proud of?' },
  { key: 'do_better', label: 'What could you do better tomorrow?',   placeholder: 'One thing to improve…' },
  { key: 'notes',     label: 'Notes',                                placeholder: 'Anything else on your mind…' },
];

function DiaryField({ label, placeholder, value, onChange, onBlur, locked }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={locked}
        rows={3}
        placeholder={locked ? '—' : placeholder}
        className={`bg-gray-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-colors
          ${locked ? 'border-gray-800 opacity-60 cursor-default' : 'border-gray-700 focus:border-emerald-500'}`}
      />
    </div>
  );
}

function DailySection() {
  const today = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [fields,  setFields]  = useState({ did_best: '', what_did: '', proud: '', do_better: '', notes: '' });
  const [locked,  setLocked]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [locking, setLocking] = useState(false);
  const [entryDates, setEntryDates] = useState([]);
  const debounceRef = useRef(null);

  // Load entry dates for navigation indicators
  useEffect(() => {
    listEntries().then(r => setEntryDates(r.data.entries.map(e => e.date))).catch(() => {});
  }, []);

  // Load entry when date changes
  useEffect(() => {
    getEntry(selectedDate).then(r => {
      const e = r.data.entry;
      if (e) {
        setFields({ did_best: e.did_best ?? '', what_did: e.what_did ?? '', proud: e.proud ?? '', do_better: e.do_better ?? '', notes: e.notes ?? '' });
        setLocked(!!e.locked);
      } else {
        setFields({ did_best: '', what_did: '', proud: '', do_better: '', notes: '' });
        setLocked(false);
      }
    }).catch(() => {});
  }, [selectedDate]);

  const save = useCallback(async (vals) => {
    if (locked) return;
    setSaving(true);
    try { await upsertEntry(selectedDate, vals); } catch {}
    finally { setSaving(false); }
  }, [selectedDate, locked]);

  function handleChange(key, val) {
    const updated = { ...fields, [key]: val };
    setFields(updated);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(updated), 800);
  }

  function handleBlur() {
    clearTimeout(debounceRef.current);
    save(fields);
  }

  async function handleLock() {
    setLocking(true);
    try {
      await save(fields);
      await lockEntry(selectedDate);
      setLocked(true);
      setEntryDates(prev => prev.includes(selectedDate) ? prev : [...prev, selectedDate]);
    } catch {}
    finally { setLocking(false); }
  }

  function shiftDate(delta) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = toDateStr(d);
    if (next > today) return; // can't go to future
    setSelectedDate(next);
  }

  const isToday   = selectedDate === today;
  const hasContent = Object.values(fields).some(v => v.trim());

  return (
    <div className="flex flex-col gap-5">
      {/* Date navigator */}
      <div className="flex items-center justify-between bg-gray-900 rounded-2xl px-4 py-3">
        <button onClick={() => shiftDate(-1)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-lg">‹</button>
        <div className="text-center">
          <div className="text-sm font-bold text-white">{fmtDate(selectedDate)}</div>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            {isToday && <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest">Today</span>}
            {locked && <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">🔒 Locked</span>}
            {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
          </div>
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-400 hover:text-white transition-colors text-lg">›</button>
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-4">
        {QUESTIONS.map(q => (
          <DiaryField
            key={q.key}
            label={q.label}
            placeholder={q.placeholder}
            value={fields[q.key]}
            onChange={e => handleChange(q.key, e.target.value)}
            onBlur={handleBlur}
            locked={locked}
          />
        ))}
      </div>

      {/* Lock button */}
      {!locked && isToday && (
        <button
          onClick={handleLock}
          disabled={locking || !hasContent}
          className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {locking ? 'Locking…' : '🔒 Lock Today\'s Entry'}
        </button>
      )}

      {locked && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center text-gray-500 text-sm">
          This entry is locked and cannot be edited.
        </div>
      )}
    </div>
  );
}

// ── Lessons Section ───────────────────────────────────────────────────────────

function LessonCard({ lesson }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-gray-900 rounded-2xl overflow-hidden border transition-colors ${open ? 'border-emerald-800' : 'border-gray-800'}`}
    >
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between px-4 py-3.5 text-left gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white leading-tight">{lesson.title}</div>
          <div className="mt-1">
            <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full font-medium">{lesson.topic}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <span className="text-[10px] text-gray-600">
            {new Date(lesson.created_at + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          <span className={`text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3">
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{lesson.content}</p>
        </div>
      )}
    </div>
  );
}

function LessonsSection() {
  const [lessons,  setLessons]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [adding,   setAdding]   = useState(false);
  const [form,     setForm]     = useState({ title: '', topic: '', content: '' });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const searchRef = useRef(null);

  async function load(q = '') {
    try { const r = await getLessons(q); setLessons(r.data.lessons); } catch {}
  }

  useEffect(() => { load(); }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(search), 300);
    return () => clearTimeout(searchRef.current);
  }, [search]);

  async function handleSubmit() {
    if (!form.title.trim() || !form.topic.trim() || !form.content.trim()) {
      return setError('All fields are required');
    }
    setSaving(true);
    setError('');
    try {
      await createLesson(form);
      setForm({ title: '', topic: '', content: '' });
      setAdding(false);
      load(search);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add lesson button / form */}
      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 border-2 border-dashed border-gray-700 hover:border-emerald-600 text-gray-500 hover:text-emerald-400 font-semibold rounded-xl transition-colors text-sm"
        >
          + Add Lesson
        </button>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-3 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">New Lesson</span>
            <button onClick={() => { setAdding(false); setError(''); }} className="text-gray-500 hover:text-white text-lg">✕</button>
          </div>
          <input
            type="text"
            placeholder="Lesson title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="Topic / category (e.g. Discipline, Business)"
            value={form.topic}
            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
          <textarea
            placeholder="Write out the lesson — what happened, what you learned, why it matters…"
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            rows={5}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-emerald-500"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title.trim() || !form.topic.trim() || !form.content.trim()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : 'Save Lesson 🔒'}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search lessons…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
      />

      {/* Lessons list */}
      {lessons.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">
          {search ? 'No lessons match your search.' : 'No lessons yet. Add your first one above.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lessons.map(l => <LessonCard key={l.id} lesson={l} />)}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiaryPage() {
  const [tab, setTab] = useState('daily');

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Diary</h1>
        <div className="flex gap-1 bg-gray-900 p-1 rounded-xl">
          {[
            { id: 'daily',   label: '📓 Daily'   },
            { id: 'lessons', label: '💡 Lessons' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === t.id ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'daily'   && <DailySection />}
      {tab === 'lessons' && <LessonsSection />}
    </div>
  );
}
