'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AvatarUploader from '../components/profile/AvatarUploader.jsx';
import ProfileForm from '../components/profile/ProfileForm.jsx';
import Spinner from '../components/shared/Spinner.jsx';
import { getEquipmentList, getUserEquipment, getOnboardingStatus, completeOnboarding } from '../api/onboardingApi.js';
import { getScheduleDay, upsertScheduleDay, createTodo, deleteTodo } from '../api/scheduleApi.js';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../api/calendarApi.js';
import api from '../api/axiosClient.js';
import { getProgramStatus } from "../api/programApi.js";
import { getLeaderboard } from "../api/leaderboardApi.js";
import { PodiumCard, RankRow } from "../components/leaderboard/LeaderboardTable.jsx";
import UserStatsDrawer from "../components/leaderboard/UserStatsDrawer.jsx";
import Link from 'next/link';

const LOCATION_OPTIONS = [
  { value: 'no_equipment', label: 'Home — No Equipment', icon: '🏠' },
  { value: 'home_equipment', label: 'Home — With Equipment', icon: '🏋️' },
  { value: 'gym', label: 'Gym', icon: '🏟️' },
];

const CATEGORY_LABELS = {
  bodyweight:   'Bodyweight Tools',
  free_weights: 'Free Weights',
  bench:        'Bench',
  bands:        'Resistance Bands',
  machines:     'Gym Machines',
  cardio:       'Cardio Equipment',
  other:        'Other',
};

// ── 60-Day Program section ───────────────────────────────────────────────────
function ProgramSection() {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    getProgramStatus().then(r => setStatus(r.data)).catch(() => {});
  }, []);

  const pct = status?.completed_days ? Math.round((status.completed_days / 60) * 100) : 0;

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="text-sm font-semibold text-white">🎯 60-Day Program</span>
        <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4">
          {!status || !status.active ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-sm text-gray-400 text-center">
                {status?.failure
                  ? `Missed Day ${status.failure.failedOnDay} — program reset.`
                  : 'No active program.'}
              </p>
              <Link href="/program"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
                Start 60-Day Program →
              </Link>
            </div>
          ) : status.starts_tomorrow ? (
            <div className="text-center py-2">
              <div className="text-2xl mb-1">🌅</div>
              <div className="text-white font-bold">Day 1 starts tomorrow</div>
              <div className="text-xs text-gray-400 mt-1">Wake up at 5:05 AM — you're ready</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-black text-emerald-400">Day {status.current_day}</div>
                  <div className="text-xs text-gray-500">Try #{status.try_number} · {status.completed_days}/60 days done</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{pct}%</div>
                  {status.today_done
                    ? <span className="text-xs text-emerald-400 font-medium">✓ Done today</span>
                    : <span className="text-xs text-yellow-400">⚡ Not logged</span>}
                </div>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: pct + '%' }} />
              </div>
              <Link href="/program"
                className="text-center text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                View full program →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Leaderboard Section ───────────────────────────────────────────────────────
function LeaderboardSection() {
  const [open, setOpen]         = useState(false);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [selected, setSelected] = useState(null); // { userId, rank }

  function handleOpen() {
    setOpen(true);
    if (!loaded) {
      setLoading(true);
      getLeaderboard()
        .then(r => { setUsers(r.data); setLoaded(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }

  const top3 = users.slice(0, 3);
  const rest  = users.slice(3);

  return (
    <>
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <button onClick={() => { open ? setOpen(false) : handleOpen(); }}
          className="w-full flex items-center justify-between px-5 py-4 text-left">
          <span className="text-sm font-semibold text-white">🏆 Leaderboard</span>
          <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {open && (
          <div className="border-t border-gray-800 pb-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-sm">No athletes yet.</div>
            ) : (
              <div className="flex flex-col gap-3 pt-4">
                {top3.length > 0 && (
                  <div className="flex gap-2 px-4">
                    {top3.map((u, i) => (
                      <PodiumCard key={u.id} rank={i + 1} user={u}
                        onClick={() => setSelected({ userId: u.id, rank: i + 1 })} />
                    ))}
                  </div>
                )}
                {rest.length > 0 && (
                  <div className="bg-gray-800 rounded-xl mx-4 overflow-hidden divide-y divide-gray-700">
                    {rest.map((u, i) => (
                      <RankRow key={u.id} rank={i + 4} user={u}
                        onClick={() => setSelected({ userId: u.id, rank: i + 4 })} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <UserStatsDrawer
          userId={selected.userId}
          rank={selected.rank}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ── Equipment section ─────────────────────────────────────────────────────────
function EquipmentSection() {
  const [open, setOpen]                     = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [currentEquipment, setCurrentEquipment] = useState([]);
  const [location, setLocation]             = useState('');
  const [equipmentData, setEquipmentData]   = useState(null);
  const [selected, setSelected]             = useState(new Set());
  const [loadingList, setLoadingList]       = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);

  useEffect(() => {
    Promise.all([getUserEquipment(), getOnboardingStatus()])
      .then(([eq, st]) => {
        setCurrentEquipment(eq.data);
        setLocation(st.data.training_location || 'home_equipment');
      })
      .catch(() => {})
      .finally(() => setLoadingCurrent(false));
  }, []);

  function handleOpen() {
    setOpen(true);
    setSaved(false);
    setSelected(new Set(currentEquipment.map(e => e.equipment_item_id)));
    if (!equipmentData) {
      setLoadingList(true);
      getEquipmentList().then(r => setEquipmentData(r.data)).catch(() => {}).finally(() => setLoadingList(false));
    }
  }

  function toggleEquipment(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function selectAll(items) {
    setSelected(prev => { const next = new Set(prev); items.forEach(i => next.add(i.id)); return next; });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await completeOnboarding({
        training_location: location,
        equipment_ids: location === 'no_equipment' ? [1] : Array.from(selected),
      });
      const eq = await getUserEquipment();
      setCurrentEquipment(eq.data);
      setOpen(false);
      setSaved(true);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-white">Equipment</div>
        <div className="flex items-center gap-2">
          {saved && !open && <span className="text-xs text-emerald-400">✓ Saved</span>}
          {!open && (
            <button onClick={handleOpen} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Update
            </button>
          )}
        </div>
      </div>

      {!open && (
        loadingCurrent ? <div className="flex justify-center py-3"><Spinner size="sm" /></div> :
        currentEquipment.length === 0 ? <p className="text-sm text-gray-500">No equipment selected.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {currentEquipment.map(eq => (
              <span key={eq.equipment_item_id} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-lg flex items-center gap-1">
                <span>{eq.icon}</span><span>{eq.name}</span>
              </span>
            ))}
          </div>
        )
      )}

      {open && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Training Location</div>
            <div className="flex flex-col gap-2">
              {LOCATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setLocation(opt.value); if (opt.value === 'no_equipment') setSelected(new Set([1])); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-all ${location === opt.value ? 'border-emerald-500 bg-emerald-950 text-white' : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'}`}
                >
                  <span>{opt.icon}</span>
                  <span className="flex-1">{opt.label}</span>
                  {location === opt.value && <span className="text-emerald-400">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {location && location !== 'no_equipment' && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available Equipment</div>
              {loadingList ? <div className="flex justify-center py-6"><Spinner /></div> : equipmentData ? (
                <div className="flex flex-col gap-4 max-h-80 overflow-y-auto pr-1">
                  {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                    const items = equipmentData.categories[cat];
                    if (!items?.length) return null;
                    const allSelected = items.every(i => selected.has(i.id));
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
                          <button onClick={() => selectAll(items)} className="text-xs text-emerald-400 hover:underline">
                            {allSelected ? '✓ All' : 'Select All'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {items.map(item => (
                            <button
                              key={item.id}
                              onClick={() => toggleEquipment(item.id)}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-all ${selected.has(item.id) ? 'border-emerald-500 bg-emerald-950 text-emerald-300' : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'}`}
                            >
                              <span>{item.icon}</span>
                              <span className="truncate flex-1">{item.name}</span>
                              {selected.has(item.id) && <span className="text-emerald-400 shrink-0">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
            <div className="flex items-center gap-3">
              {location !== 'no_equipment' && <span className="text-xs text-gray-500">{selected.size} selected</span>}
              <button
                onClick={handleSave}
                disabled={saving || !location}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile Page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const joined = user?.created_at
    ? new Date(user.created_at + 'Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;
  const age = user?.birth_date
    ? Math.floor((Date.now() - new Date(user.birth_date)) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-2xl font-black text-white">Profile</h1>

      {/* Hero card */}
      <div className="bg-gray-900 rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <AvatarUploader size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-xl font-black text-white truncate">{user?.name || 'Your Name'}</div>
            <div className="text-sm text-gray-400 mt-0.5 truncate">{user?.email}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {joined && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">Since {joined}</span>}
              {age    && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{age} yrs</span>}
              {user?.initial_weight && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{user.initial_weight} kg</span>}
              {user?.initial_height && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{user.initial_height} cm</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile (collapsible) */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <button
          onClick={() => setEditOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-white">Edit Profile</span>
          <span className={`text-gray-400 transition-transform duration-200 ${editOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {editOpen && (
          <div className="px-5 pb-5 border-t border-gray-800 pt-4">
            <ProfileForm />
          </div>
        )}
      </div>

      <ProgramSection />
      <LeaderboardSection />
      <EquipmentSection />
      <CalendarSection />
      <NotificationsSection />
    </div>
  );
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
function fmt12(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function addMins(hhmm, mins) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const t = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
function calcSched(leaveTime) {
  if (!leaveTime) return {};
  return {
    wake_time: '05:05',
    cold_plunge_time: '05:10',
    train_time: '05:20',
    shower_time: '06:20',
    meditate_time: '06:35',
    bedtime: '21:05',
    stretch_time: '20:20',
  };
}
function isoToYM(iso) { return iso.slice(0,7); }
function daysInMonth(y,m) { return new Date(y, m, 0).getDate(); }
function firstDOW(y,m) { return new Date(y, m-1, 1).getDay(); } // 0=Sun

// ── Timeline Block ────────────────────────────────────────────────────────────
function TimelineBlock({ time, duration, label, color, sub, badge }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-16 shrink-0 text-right pt-0.5">
        <div className="text-xs font-bold text-white">{fmt12(time)}</div>
        {duration && <div className="text-[10px] text-gray-500">{duration}</div>}
      </div>
      <div className="flex items-start gap-2 flex-1 pb-3 border-l-2 pl-3" style={{ borderColor: color }}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white leading-tight">{label}</span>
            {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: color + '33', color }}>{badge}</span>}
          </div>
          {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Calendar Section ──────────────────────────────────────────────────────────
function CalendarSection() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [viewDate, setViewDate]   = useState(null); // selected day ISO string
  const [curYM,    setCurYM]      = useState(() => todayStr.slice(0,7));
  const [monthEvents, setMonthEvents] = useState([]);
  const [dayData,  setDayData]    = useState(null);  // { sched, events }
  const [loadingDay, setLoadingDay] = useState(false);
  const [open,     setOpen]       = useState(false);

  // Day detail state
  const [tab,        setTab]      = useState('view');  // 'view' | 'leave' | 'add'
  const [addType,    setAddType]  = useState('appointment'); // 'appointment' | 'reminder'
  const [leaveTime,  setLeaveTime]  = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [saving,     setSaving]   = useState(false);
  const [evTitle,    setEvTitle]  = useState('');
  const [evTime,     setEvTime]   = useState('');
  const [evDur,      setEvDur]    = useState('');
  const [evNotes,    setEvNotes]  = useState('');
  const [evError,    setEvError]  = useState('');
  const [editEv,     setEditEv]   = useState(null);   // event being edited
  const [editTime,   setEditTime] = useState('');

  // Load month events (dots)
  async function loadMonth(ym) {
    try {
      const res = await getEvents(ym);
      const all = res.data?.events ?? res.data ?? [];
      setMonthEvents(all.filter(e => !e.is_canceled));
    } catch {}
  }

  // Load selected day detail
  async function loadDay(dateStr) {
    setLoadingDay(true); setDayData(null);
    try {
      const ym = dateStr.slice(0,7);
      const [sc, ev] = await Promise.allSettled([getScheduleDay(dateStr), getEvents(ym)]);
      const sched = sc.status === 'fulfilled' ? sc.value.data : null;
      const all   = ev.status === 'fulfilled' ? (ev.value.data?.events ?? ev.value.data ?? []) : [];
      const dayEvs = all.filter(e => e.date === dateStr && !e.is_canceled);
      setDayData({ sched, events: dayEvs });
      setLeaveTime(sched?.leave_time || '');
      setReturnTime(sched?.return_time || '');
    } finally { setLoadingDay(false); }
  }

  function handleOpen() {
    setOpen(true);
    loadMonth(curYM);
  }

  function prevMonth() {
    const [y,m] = curYM.split('-').map(Number);
    const newYM = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
    setCurYM(newYM); loadMonth(newYM); setViewDate(null);
  }
  function nextMonth() {
    const [y,m] = curYM.split('-').map(Number);
    const newYM = m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
    setCurYM(newYM); loadMonth(newYM); setViewDate(null);
  }

  function selectDay(dateStr) {
    setViewDate(dateStr); setTab('view');
    setEvTitle(''); setEvTime(''); setEvDur(''); setEvNotes(''); setEvError(''); setEditEv(null);
    loadDay(dateStr);
  }

  async function handleSaveLeave() {
    setSaving(true);
    try {
      await upsertScheduleDay(viewDate, { leave_time: leaveTime, return_time: returnTime || undefined });
      await loadDay(viewDate); await loadMonth(curYM);
      setTab('view');
    } finally { setSaving(false); }
  }

  async function handleAddEvent() {
    setEvError('');
    if (!evTitle.trim() || !evTime) { setEvError('Title and time required'); return; }
    const sched = dayData?.sched;
    if (addType === 'appointment' && sched?.leave_time && sched?.return_time) {
      if (evTime < sched.leave_time || evTime > sched.return_time) {
        setEvError(`Appointments must be between ${fmt12(sched.leave_time)} and ${fmt12(sched.return_time)}`);
        return;
      }
    }
    await createEvent({
      date: viewDate, title: evTitle.trim(), time: evTime,
      duration_mins: parseInt(evDur)||null, notes: evNotes||null,
      event_type: addType,
    });
    setEvTitle(''); setEvTime(''); setEvDur(''); setEvNotes(''); setTab('view');
    await loadDay(viewDate); await loadMonth(curYM);
  }

  async function handleDeleteEvent(id) {
    await deleteEvent(id);
    await loadDay(viewDate); await loadMonth(curYM);
  }

  async function handleUpdateEventTime(id) {
    if (!editTime) return;
    await updateEvent(id, { time: editTime });
    setEditEv(null); setEditTime('');
    await loadDay(viewDate); await loadMonth(curYM);
  }

  // Build calendar grid
  const [gridY, gridM] = curYM.split('-').map(Number);
  const numDays = daysInMonth(gridY, gridM);
  const startDow = firstDOW(gridY, gridM); // 0=Sun
  const startOffset = startDow; // Sun=0 offset
  const totalCells = Math.ceil((startOffset + numDays) / 7) * 7;

  // Event dots per day
  const eventDots = {};
  monthEvents.forEach(e => {
    if (!eventDots[e.date]) eventDots[e.date] = { appt: 0, reminder: 0 };
    if (e.event_type === 'reminder') eventDots[e.date].reminder++;
    else eventDots[e.date].appt++;
  });

  // Day timeline blocks
  const buildTimeline = (sched, events) => {
    const s = sched?.schedule ?? {};
    return [
      s.wake_time        && { time: s.wake_time,        label: 'Wake Up',      duration: '',      color: '#10b981', badge: 'non-neg' },
      s.cold_plunge_time && { time: s.cold_plunge_time, label: 'Cold Plunge',  duration: '5min',  color: '#38bdf8' },
      s.train_time       && { time: s.train_time,       label: 'Training',     duration: '1h',    color: '#10b981' },
      s.shower_time    && { time: s.shower_time,     label: 'Shower',         duration: '15min', color: '#60a5fa' },
      s.meditate_time  && { time: s.meditate_time,   label: 'Meditation',     duration: '1h',    color: '#a78bfa', badge: 'non-neg' },
      sched?.leave_time  && { time: sched.leave_time,  label: 'Leave Home',     color: '#f59e0b' },
      ...(events || []).filter(e=>e.event_type!=='reminder').map(e => ({
        time: e.time, label: e.title,
        duration: e.duration_mins ? `${e.duration_mins}min` : null,
        color: '#ec4899', sub: e.notes, badge: 'appt',
      })),
      sched?.return_time && { time: sched.return_time, label: 'Return Home',    color: '#f59e0b' },
      s.stretch_time   && { time: s.stretch_time,    label: 'Stretch',        duration: '30min', color: '#06b6d4', badge: 'non-neg' },
      ...(events || []).filter(e=>e.event_type==='reminder').map(e => ({
        time: e.time, label: e.title, color: '#f97316', sub: e.notes, badge: '🔔',
      })),
      s.bedtime        && { time: s.bedtime,         label: 'Bedtime',        color: '#6366f1' },
    ].filter(Boolean).sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'));
  };

  const timeline = viewDate && dayData ? buildTimeline(dayData.sched, dayData.events) : [];
  const dayLabel = viewDate ? new Date(viewDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <button onClick={() => { setOpen(o => !o); if (!open) handleOpen(); }}
        className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="text-sm font-semibold text-white">📅 Calendar</span>
        <span className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-5 border-t border-gray-800 pt-4 flex flex-col gap-4">

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">‹</button>
            <span className="text-sm font-bold text-white">{MONTHS[gridM-1]} {gridY}</span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">›</button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 text-center">
            {DAYS.map(d => <div key={d} className="text-[10px] font-semibold text-gray-600 py-1">{d}</div>)}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1 -mt-2">
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - startOffset + 1;
              if (dayNum < 1 || dayNum > numDays) return <div key={i} />;
              const dateStr = `${curYM}-${String(dayNum).padStart(2,'0')}`;
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === viewDate;
              const dots = eventDots[dateStr];
              return (
                <button key={i} onClick={() => selectDay(dateStr)}
                  className={`flex flex-col items-center py-1 rounded-xl transition-all ${isSelected ? 'bg-emerald-600' : isToday ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
                  <span className={`text-xs font-semibold ${isSelected ? 'text-white' : isToday ? 'text-emerald-400' : 'text-gray-300'}`}>{dayNum}</span>
                  {dots && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dots.appt > 0    && <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />}
                      {dots.reminder > 0 && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Day detail */}
          {viewDate && (
            <div className="flex flex-col gap-3 border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-white">{dayLabel}</div>
                <div className="flex gap-1.5">
                  <button onClick={() => setTab(t => t === 'leave' ? 'view' : 'leave')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${tab==='leave' ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    ✏️ Leave Time
                  </button>
                  <button onClick={() => setTab(t => t === 'add' ? 'view' : 'add')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${tab==='add' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    + Add
                  </button>
                </div>
              </div>

              {/* Change leave time panel */}
              {tab === 'leave' && (
                <div className="bg-gray-800 rounded-xl p-3 flex flex-col gap-3">
                  <div className="text-xs text-gray-400">Changing leave time recalculates your entire morning routine for this day.</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Leave home</label>
                      <input type="time" value={leaveTime} onChange={e => setLeaveTime(e.target.value)}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Return home</label>
                      <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  {leaveTime && (
                    <div className="text-xs text-gray-500">
                      New wake: <span className="text-white font-semibold">{fmt12(addMins(leaveTime, -(60+15+60+10)))}</span>
                      &nbsp;· Bed: <span className="text-white font-semibold">{fmt12(addMins(addMins(leaveTime, -(60+15+60+10)), -8*60))}</span>
                    </div>
                  )}
                  <button onClick={handleSaveLeave} disabled={saving || !leaveTime}
                    className="py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
                    {saving ? 'Saving…' : 'Save & Recalculate'}
                  </button>
                </div>
              )}

              {/* Add event / reminder panel */}
              {tab === 'add' && (
                <div className="bg-gray-800 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex bg-gray-700 rounded-lg p-0.5">
                    {['appointment','reminder'].map(t => (
                      <button key={t} onClick={() => { setAddType(t); setEvError(''); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${addType===t ? 'bg-gray-600 text-white' : 'text-gray-500'}`}>
                        {t === 'appointment' ? '📅 Appointment' : '🔔 Reminder'}
                      </button>
                    ))}
                  </div>
                  {addType === 'appointment' && dayData?.sched?.leave_time && (
                    <div className="text-xs text-gray-500">Appointments allowed between {fmt12(dayData.sched.leave_time)} and {fmt12(dayData.sched.return_time)}</div>
                  )}
                  <input value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Title *"
                    className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full placeholder-gray-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="time" value={evTime} onChange={e => setEvTime(e.target.value)}
                      className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2" />
                    {addType === 'appointment' && (
                      <input value={evDur} onChange={e => setEvDur(e.target.value)} type="number" placeholder="Duration (min)"
                        className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500" />
                    )}
                  </div>
                  <input value={evNotes} onChange={e => setEvNotes(e.target.value)} placeholder="Notes (optional)"
                    className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full placeholder-gray-500" />
                  {evError && <p className="text-xs text-red-400">{evError}</p>}
                  <button onClick={handleAddEvent} disabled={!evTitle.trim() || !evTime}
                    className="py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
                    Add {addType === 'reminder' ? 'Reminder' : 'Appointment'}
                  </button>
                </div>
              )}

              {/* Timeline */}
              {loadingDay ? (
                <div className="flex justify-center py-3"><Spinner /></div>
              ) : timeline.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-2">No program set up for this day.</p>
              ) : (
                <div className="flex flex-col pt-1">
                  {timeline.map((b, i) => {
                    const isCustomAppt = dayData?.events?.some(e => e.title === b.label && b.badge === 'appt');
                    const evObj = dayData?.events?.find(e => e.title === b.label && (b.badge === 'appt' || b.badge === '🔔'));
                    return (
                      <div key={i}>
                        <TimelineBlock {...b} />
                        {evObj && (
                          <div className="ml-[76px] -mt-2 mb-2 flex gap-2 items-center">
                            {editEv === evObj.id ? (
                              <>
                                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                                  className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600" />
                                <button onClick={() => handleUpdateEventTime(evObj.id)} className="text-xs text-emerald-400 font-semibold">Save</button>
                                <button onClick={() => setEditEv(null)} className="text-xs text-gray-500">Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setEditEv(evObj.id); setEditTime(evObj.time || ''); }}
                                  className="text-xs text-gray-500 hover:text-yellow-400">✏️ edit</button>
                                <button onClick={() => handleDeleteEvent(evObj.id)}
                                  className="text-xs text-gray-600 hover:text-red-400">× delete</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-600 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block"/>Appointment</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Reminder</span>
            <span className="flex items-center gap-1"><span className="text-[10px] font-semibold text-emerald-500">non-neg</span>=fixed</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Push Notifications ────────────────────────────────────────────────────────
function NotificationsSection() {
  const [status,   setStatus]   = useState('unknown'); // 'unknown' | 'denied' | 'subscribed' | 'unsubscribed'
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported'); return;
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return; }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      setStatus(sub ? 'subscribed' : 'unsubscribed');
    });
  }, []);

  async function handleEnable() {
    setLoading(true); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); setMsg('Permission denied.'); return; }

      const vapidRes = await api.get('/users/vapid-public-key');
      const vapidKey = vapidRes.data.key;
      const keyBytes = Uint8Array.from(atob(vapidKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });

      await api.post('/users/push-subscription', sub.toJSON());
      setStatus('subscribed');
      setMsg('Notifications enabled! You\'ll get a reminder at 9 PM if habits are incomplete.');
    } catch (e) {
      setMsg('Failed to enable notifications.');
    } finally { setLoading(false); }
  }

  async function handleDisable() {
    setLoading(true); setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.delete('/users/push-subscription');
      setStatus('unsubscribed');
      setMsg('Notifications disabled.');
    } catch { setMsg('Failed to disable.'); }
    finally { setLoading(false); }
  }

  if (status === 'unsupported') return null;

  return (
    <div className="bg-gray-900 rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Streak Notifications</div>
          <div className="text-xs text-gray-500 mt-0.5">9 PM reminder if habits are incomplete</div>
        </div>
        {status === 'subscribed' ? (
          <button onClick={handleDisable} disabled={loading}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40">
            {loading ? '…' : 'Disable'}
          </button>
        ) : (
          <button onClick={handleEnable} disabled={loading || status === 'denied'}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40">
            {loading ? '…' : 'Enable'}
          </button>
        )}
      </div>
      {status === 'denied' && <p className="text-xs text-red-400 mt-2">Blocked by browser — allow in site settings.</p>}
      {status === 'subscribed' && <div className="flex items-center gap-1.5 mt-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-xs text-emerald-400">Active</span></div>}
      {msg && <p className="text-xs text-gray-400 mt-2">{msg}</p>}
    </div>
  );
}
