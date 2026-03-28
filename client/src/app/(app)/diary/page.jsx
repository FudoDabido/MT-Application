'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { listEntries, getEntry, upsertEntry, lockEntry, getLessons, createLesson } from '../../../api/diaryApi.js';
import Card from '../../../design-system/Card.jsx';
import Tabs from '../../../design-system/Tabs.jsx';
import Badge from '../../../design-system/Badge.jsx';

function toDateStr(d) { return d.toISOString().split('T')[0]; }
function fmtDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const QUESTIONS = [
  { key: 'did_best',  label: 'Did you do your best today?',        placeholder: 'Be honest with yourself…' },
  { key: 'what_did',  label: 'What did you do today?',             placeholder: 'Walk through your day…' },
  { key: 'proud',     label: 'Are you proud of yourself?',         placeholder: 'What are you proud of?' },
  { key: 'do_better', label: 'What could you do better tomorrow?', placeholder: 'One thing to improve…' },
  { key: 'notes',     label: 'Notes',                              placeholder: 'Anything else on your mind…' },
];

function DailyTab() {
  const today = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [fields,  setFields]  = useState({ did_best: '', what_did: '', proud: '', do_better: '', notes: '' });
  const [locked,  setLocked]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [locking, setLocking] = useState(false);
  const debounceRef = useRef(null);

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
    } catch {} finally { setLocking(false); }
  }

  function shiftDate(delta) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = toDateStr(d);
    if (next > today) return;
    setSelectedDate(next);
  }

  const isToday = selectedDate === today;
  const hasContent = Object.values(fields).some(v => v.trim());

  return (
    <div className="flex flex-col gap-4">
      {/* Date nav */}
      <Card className="flex items-center justify-between py-3">
        <button onClick={() => shiftDate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--card-2)] text-[var(--text-2)] active:opacity-70">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-white">{fmtDate(selectedDate)}</div>
          <div className="flex items-center justify-center gap-2 mt-0.5 h-4">
            {isToday && <span className="text-[10px] text-[var(--accent)] font-semibold uppercase tracking-widest">Today</span>}
            {locked && <Badge variant="neutral">🔒 Locked</Badge>}
            {saving && <span className="text-[10px] text-[var(--text-3)]">Saving…</span>}
          </div>
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--card-2)] text-[var(--text-2)] disabled:opacity-30 active:opacity-70">
          <ChevronRight className="w-5 h-5" />
        </button>
      </Card>

      {/* Questions */}
      <div className="flex flex-col gap-3">
        {QUESTIONS.map(q => (
          <div key={q.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-widest">{q.label}</label>
            <textarea
              value={fields[q.key]}
              onChange={e => handleChange(q.key, e.target.value)}
              onBlur={handleBlur}
              readOnly={locked}
              rows={3}
              placeholder={locked ? '—' : q.placeholder}
              className={`bg-[var(--card-2)] border rounded-xl px-4 py-3 text-sm text-white placeholder-[var(--text-3)] resize-none focus:outline-none transition-colors
                ${locked ? 'border-[var(--border)] opacity-60 cursor-default' : 'border-[var(--border)] focus:border-[var(--accent)]'}`}
            />
          </div>
        ))}
      </div>

      {!locked && isToday && (
        <button onClick={handleLock} disabled={locking || !hasContent}
          className="w-full py-3.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-black font-black rounded-2xl transition-colors">
          {locking ? 'Locking…' : '🔒 Lock Today\'s Entry'}
        </button>
      )}
      {locked && (
        <Card elevated className="text-center">
          <span className="text-[var(--text-3)] text-sm">This entry is locked and cannot be edited.</span>
        </Card>
      )}
    </div>
  );
}

function LessonsTab() {
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

  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(search), 300);
    return () => clearTimeout(searchRef.current);
  }, [search]);

  async function handleSubmit() {
    if (!form.title.trim() || !form.topic.trim() || !form.content.trim()) {
      return setError('All fields are required');
    }
    setSaving(true); setError('');
    try {
      await createLesson(form);
      setForm({ title: '', topic: '', content: '' });
      setAdding(false);
      load(search);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Add lesson */}
      {!adding ? (
        <button onClick={() => setAdding(true)}
          className="w-full py-3.5 border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-3)] hover:text-[var(--accent)] font-semibold rounded-2xl transition-colors text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Lesson
        </button>
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">New Lesson</span>
            <button onClick={() => { setAdding(false); setError(''); }} className="text-[var(--text-3)] text-lg">✕</button>
          </div>
          <input type="text" placeholder="Lesson title" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />
          <input type="text" placeholder="Topic / category (e.g. Discipline)" value={form.topic}
            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
            className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />
          <textarea placeholder="Write out the lesson…" value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            rows={5}
            className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--text-3)] resize-none focus:outline-none focus:border-[var(--accent)]" />
          {error && <p className="text-[var(--danger)] text-xs">{error}</p>}
          <button onClick={handleSubmit} disabled={saving || !form.title.trim() || !form.topic.trim() || !form.content.trim()}
            className="w-full py-3 bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-black font-black rounded-xl transition-colors">
            {saving ? 'Saving…' : 'Save Lesson 🔒'}
          </button>
        </Card>
      )}

      {/* Search */}
      <input type="search" placeholder="Search lessons…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />

      {/* Lessons list */}
      {lessons.length === 0
        ? <p className="text-sm text-[var(--text-3)] text-center py-4">No lessons yet.</p>
        : lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)
      }
    </div>
  );
}

function LessonCard({ lesson }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={`overflow-hidden transition-colors ${open ? 'border border-[var(--accent-dim)]' : ''}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between text-left gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white leading-tight">{lesson.title}</div>
          <div className="mt-1.5">
            <span className="text-[10px] bg-[var(--accent-dim)] text-[var(--accent)] px-2 py-0.5 rounded-full font-medium">
              {lesson.topic}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <span className="text-[10px] text-[var(--text-3)]">
            {new Date(lesson.created_at + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          <ChevronRight className={`w-4 h-4 text-[var(--text-3)] transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="pt-3 mt-3 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-2)] whitespace-pre-wrap leading-relaxed">{lesson.content}</p>
        </div>
      )}
    </Card>
  );
}

export default function DiaryPage() {
  const [tab, setTab] = useState('daily');

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <h1 className="text-2xl font-bold text-white">Journal</h1>
      <Tabs
        tabs={[{ value: 'daily', label: 'Daily' }, { value: 'lessons', label: 'Lessons' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'daily'   ? <DailyTab />   : <LessonsTab />}
      <div className="h-2" />
    </div>
  );
}
