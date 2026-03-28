'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useRouter } from 'next/navigation.js';
import Avatar from '../../../design-system/Avatar.jsx';
import Card from '../../../design-system/Card.jsx';
import Badge from '../../../design-system/Badge.jsx';
import Toggle from '../../../design-system/Toggle.jsx';
import Skeleton from '../../../design-system/Skeleton.jsx';
import AvatarUploader from '../../../components/profile/AvatarUploader.jsx';
import ProfileForm from '../../../components/profile/ProfileForm.jsx';
import { getProfileStats } from '../../../api/usersApi.js';
import { getEquipmentList, getUserEquipment, getOnboardingStatus, completeOnboarding } from '../../../api/onboardingApi.js';
import api from '../../../api/axiosClient.js';
import { getLeaderboard } from '../../../api/leaderboardApi.js';
import { PodiumCard, RankRow } from '../../../components/leaderboard/LeaderboardTable.jsx';
import UserStatsDrawer from '../../../components/leaderboard/UserStatsDrawer.jsx';

const LOCATION_OPTIONS = [
  { value: 'no_equipment',    label: 'Home — No Equipment',    icon: '🏠' },
  { value: 'home_equipment',  label: 'Home — With Equipment',  icon: '🏋️' },
  { value: 'gym',             label: 'Gym',                    icon: '🏟️' },
];
const CATEGORY_LABELS = {
  bodyweight:   'Bodyweight',
  free_weights: 'Free Weights',
  bench:        'Bench',
  bands:        'Resistance Bands',
  machines:     'Machines',
  cardio:       'Cardio',
  other:        'Other',
};

const NAV_ITEMS = [
  { label: 'Program', href: '/program', icon: '📋' },
];

function EquipmentSection() {
  const [open,            setOpen]            = useState(false);
  const [loadingCurrent,  setLoadingCurrent]  = useState(true);
  const [currentEquipment, setCurrentEquipment] = useState([]);
  const [location,        setLocation]        = useState('');
  const [equipmentData,   setEquipmentData]   = useState(null);
  const [selected,        setSelected]        = useState(new Set());
  const [loadingList,     setLoadingList]      = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

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
    setOpen(true); setSaved(false);
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
      setOpen(false); setSaved(true);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  return (
    <Card>
      <button onClick={open ? () => setOpen(false) : handleOpen} className="w-full flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Equipment</span>
        <div className="flex items-center gap-2">
          {saved && !open && <span className="text-xs text-[var(--accent)]">✓ Saved</span>}
          <ChevronDown className={`w-4 h-4 text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {!open && (
        loadingCurrent ? null :
        currentEquipment.length === 0 ? <p className="text-sm text-[var(--text-3)] mt-2">No equipment selected.</p> : (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {currentEquipment.map(eq => (
              <span key={eq.equipment_item_id} className="text-xs bg-[var(--card-2)] text-[var(--text-2)] px-2 py-1 rounded-lg flex items-center gap-1">
                <span>{eq.icon}</span><span>{eq.name}</span>
              </span>
            ))}
          </div>
        )
      )}

      {open && (
        <div className="flex flex-col gap-4 mt-3 pt-3 border-t border-[var(--border)]">
          <div>
            <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-2">Training Location</div>
            <div className="flex flex-col gap-2">
              {LOCATION_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => { setLocation(opt.value); if (opt.value === 'no_equipment') setSelected(new Set([1])); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${location === opt.value ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-white' : 'border-[var(--border)] bg-[var(--card-2)] text-[var(--text-2)]'}`}>
                  <span>{opt.icon}</span>
                  <span className="flex-1">{opt.label}</span>
                  {location === opt.value && <span className="text-[var(--accent)]">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {location && location !== 'no_equipment' && (
            <div>
              <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-2">Available Equipment</div>
              {loadingList ? <p className="text-sm text-[var(--text-3)] py-4 text-center">Loading…</p> : equipmentData ? (
                <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1">
                  {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                    const items = equipmentData.categories[cat];
                    if (!items?.length) return null;
                    const allSelected = items.every(i => selected.has(i.id));
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wide">{label}</span>
                          <button onClick={() => selectAll(items)} className="text-xs text-[var(--accent)]">
                            {allSelected ? '✓ All' : 'Select All'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {items.map(item => (
                            <button key={item.id} onClick={() => toggleEquipment(item.id)}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left text-xs transition-all ${selected.has(item.id) ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--card-2)] text-[var(--text-2)]'}`}>
                              <span>{item.icon}</span>
                              <span className="truncate flex-1">{item.name}</span>
                              {selected.has(item.id) && <span className="text-[var(--accent)] shrink-0">✓</span>}
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

          <div className="flex items-center justify-between">
            <button onClick={() => setOpen(false)} className="text-sm text-[var(--text-3)]">Cancel</button>
            <div className="flex items-center gap-3">
              {location !== 'no_equipment' && <span className="text-xs text-[var(--text-3)]">{selected.size} selected</span>}
              <button onClick={handleSave} disabled={saving || !location}
                className="px-5 py-2 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-black font-bold text-sm rounded-xl transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


function LeaderboardSection() {
  const [open,     setOpen]     = useState(false);
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [loaded,   setLoaded]   = useState(false);
  const [selected, setSelected] = useState(null);

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
      <Card className="p-0 overflow-hidden">
        <button onClick={() => { open ? setOpen(false) : handleOpen(); }}
          className="w-full flex items-center justify-between px-4 py-3.5">
          <span className="text-sm font-semibold text-white">🏆 Leaderboard</span>
          <ChevronDown className={`w-4 h-4 text-[var(--text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="border-t border-[var(--border)] pb-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-6 text-[var(--text-3)] text-sm">No athletes yet.</div>
            ) : (
              <div className="flex flex-col gap-3 pt-3">
                {top3.length > 0 && (
                  <div className="flex gap-2 px-3">
                    {top3.map((u, i) => (
                      <PodiumCard key={u.id} rank={i + 1} user={u}
                        onClick={() => setSelected({ userId: u.id, rank: i + 1 })} />
                    ))}
                  </div>
                )}
                {rest.length > 0 && (
                  <div className="mx-3 rounded-xl overflow-hidden divide-y divide-[var(--border)] bg-[var(--card-2)]">
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
      </Card>

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

function NotificationsSection() {
  const [status,  setStatus]  = useState('unknown');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
    if (Notification.permission === 'denied') { setStatus('denied'); return; }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      setStatus(sub ? 'subscribed' : 'unsubscribed');
    });
  }, []);

  async function handleEnable() {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }
      const vapidRes = await api.get('/users/vapid-public-key');
      const keyBytes = Uint8Array.from(atob(vapidRes.data.key.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
      await api.post('/users/push-subscription', sub.toJSON());
      setStatus('subscribed');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.delete('/users/push-subscription');
      setStatus('unsubscribed');
    } catch {} finally { setLoading(false); }
  }

  if (status === 'unsupported') return null;

  return (
    <Card className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-white">Streak Notifications</div>
        <div className="text-xs text-[var(--text-3)] mt-0.5">9 PM reminder if habits are incomplete</div>
        {status === 'denied' && <div className="text-xs text-[var(--danger)] mt-0.5">Blocked in browser settings</div>}
      </div>
      <Toggle
        checked={status === 'subscribed'}
        onChange={status === 'subscribed' ? handleDisable : handleEnable}
        disabled={loading || status === 'denied'}
      />
    </Card>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats,    setStats]    = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    getProfileStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const joined = user?.created_at
    ? new Date(user.created_at + 'Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;
  const avatarSrc = user?.photo_path ? `/${user.photo_path}` : null;

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {/* Profile hero */}
      <Card className="flex items-center gap-4">
        <AvatarUploader size="lg" />
        <div className="flex-1 min-w-0">
          <div className="text-xl font-black text-white truncate">{user?.name || 'Your Name'}</div>
          <div className="text-sm text-[var(--text-3)] truncate">@{user?.username || user?.email}</div>
          {joined && <div className="text-xs text-[var(--text-3)] mt-1">Since {joined}</div>}
        </div>
      </Card>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Sessions', value: stats.sessions ?? 0, color: 'text-[var(--accent)]' },
            { label: 'Streak',   value: `${stats.streak ?? 0}d`, color: 'text-orange-400' },
            { label: 'Day',      value: `${stats.program_day ?? '—'}/60`, color: 'text-blue-400' },
          ].map(s => (
            <Card key={s.label} className="text-center py-3">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Navigation links */}
      <Card className="flex flex-col divide-y divide-[var(--border)] p-0 overflow-hidden">
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-3 px-4 py-3.5 active:bg-[var(--card-2)] transition-colors">
            <span className="text-xl w-7">{item.icon}</span>
            <span className="text-sm font-medium text-white flex-1">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-[var(--text-3)]" />
          </Link>
        ))}
      </Card>

      {/* Leaderboard */}
      <LeaderboardSection />

      {/* Settings */}
      <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Settings</p>
      <NotificationsSection />
      <EquipmentSection />

      {/* Edit profile */}
      <Card>
        <button onClick={() => setEditOpen(o => !o)} className="w-full flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Edit Profile</span>
          <ChevronDown className={`w-4 h-4 text-[var(--text-3)] transition-transform ${editOpen ? 'rotate-180' : ''}`} />
        </button>
        {editOpen && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <ProfileForm />
          </div>
        )}
      </Card>

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full py-3.5 border border-[var(--danger)] text-[var(--danger)] font-bold rounded-2xl text-sm active:opacity-70 transition-opacity">
        Log Out
      </button>

      <div className="h-2" />
    </div>
  );
}
