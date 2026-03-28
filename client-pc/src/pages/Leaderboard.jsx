import React, { useState, useEffect } from 'react';
import { getLeaderboard, getChallenges, searchUser, sendChallenge } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Search, Plus, X } from 'lucide-react';

const FILTERS = [
  { label: 'All',    value: '' },
  { label: 'Wk 1-2', value: 'week12' },
  { label: 'Wk 3-4', value: 'week34' },
  { label: 'Wk 5-6', value: 'week56' },
  { label: 'Wk 7-8', value: 'week78' },
];
const SORTS = [
  { label: 'Activity', value: 'activity' },
  { label: 'Volume',   value: 'volume' },
  { label: 'Reps',     value: 'reps' },
];
const RANK_ICONS = ['🥇','🥈','🥉'];

export default function Leaderboard() {
  const { user } = useAuth();
  const [filter,    setFilter]    = useState('');
  const [sort,      setSort]      = useState('activity');
  const [board,     setBoard]     = useState([]);
  const [challenges,setChallenges]= useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [duration,  setDuration]  = useState(7);
  const [sending,   setSending]   = useState(false);

  async function load() {
    setLoading(true);
    const [lb, ch] = await Promise.allSettled([getLeaderboard(filter, sort), getChallenges()]);
    if (lb.status === 'fulfilled') setBoard(lb.value.data || []);
    if (ch.status === 'fulfilled') setChallenges(ch.value.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filter, sort]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      searchUser(query).then(r => setResults(r.data || [])).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function handleSend(targetId) {
    setSending(true);
    try {
      await sendChallenge({ challenged_id: targetId, duration_days: duration });
      setShowForm(false); setQuery(''); setResults([]);
      await load();
    } catch {} finally { setSending(false); }
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      <h1 className="text-2xl font-black text-white">Leaderboard</h1>

      <div className="grid grid-cols-12 gap-4">
        {/* Left — 8 cols */}
        <div className="col-span-8 flex flex-col gap-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1 border border-[var(--border)]">
              {FILTERS.map(f => (
                <button key={f.value} onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.value ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text-2)] hover:text-white'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1 border border-[var(--border)]">
              {SORTS.map(s => (
                <button key={s.value} onClick={() => setSort(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sort === s.value ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'text-[var(--text-2)] hover:text-white'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-3)] text-sm">Loading…</div>
            ) : !board.length ? (
              <div className="p-8 text-center text-[var(--text-3)] text-sm">No users on leaderboard yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['#','User','Program Day','Sessions','Reps','Days Active'].map(h => (
                      <th key={h} className="py-3 px-4 text-left text-xs text-[var(--text-3)] font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {board.map((u, i) => {
                    const isMe = u.id === user?.id;
                    return (
                      <tr key={u.id}
                        className={`border-b border-[var(--border)] transition-colors ${isMe ? 'bg-emerald-900/20 border-l-2 border-l-emerald-500' : 'hover:bg-[var(--card-2)]'}`}>
                        <td className="py-3 px-4 font-bold text-[var(--text-2)]">
                          {i < 3 ? RANK_ICONS[i] : `${i + 1}`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[var(--card-2)] flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0 overflow-hidden">
                              {u.photo_path ? <img src={`/uploads/${u.photo_path}`} className="w-full h-full object-cover" alt="" /> : (u.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2)}
                            </div>
                            <div>
                              <div className={`text-sm font-bold ${isMe ? 'text-[var(--accent)]' : 'text-white'}`}>
                                {u.name} {isMe && '(You)'}
                              </div>
                              <div className="text-xs text-[var(--text-3)]">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[var(--accent)] font-bold">Day {u.program_day || '—'}</td>
                        <td className="py-3 px-4 text-white">{u.total_logs || 0}</td>
                        <td className="py-3 px-4 text-[var(--text-2)]">{(u.total_reps || 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-[var(--text-2)]">{u.days_active || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right — 4 cols: Challenges */}
        <div className="col-span-4 flex flex-col gap-4">
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Challenges</div>
              <button onClick={() => setShowForm(f => !f)}
                className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity font-medium">
                {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showForm ? 'Cancel' : 'New'}
              </button>
            </div>

            {showForm && (
              <div className="mb-4 flex flex-col gap-3 p-3 bg-[var(--card-2)] rounded-xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)]" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search username…"
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--accent)]" />
                </div>
                {results.length > 0 && (
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {results.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-[var(--card)] rounded-xl">
                        <span className="text-xs text-white">{r.name} <span className="text-[var(--text-3)]">@{r.username}</span></span>
                        <button onClick={() => handleSend(r.id)} disabled={sending}
                          className="text-[10px] px-2.5 py-1 bg-[var(--accent)] text-black font-bold rounded-lg disabled:opacity-50">
                          {sending ? '…' : 'Challenge'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-3)]">Duration:</span>
                  {[7,14,30].map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${duration === d ? 'bg-[var(--accent-dim)] text-[var(--accent)]' : 'bg-[var(--card)] text-[var(--text-2)]'}`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!challenges.length ? (
              <div className="text-center py-6 text-sm text-[var(--text-3)]">No active challenges</div>
            ) : (
              <div className="flex flex-col gap-3">
                {challenges.map((c, i) => {
                  const pct = c.days_active != null && c.duration_days ? Math.min(100, Math.round((c.days_active / c.duration_days) * 100)) : 0;
                  return (
                    <div key={i} className="bg-[var(--card-2)] rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">{c.challenger_name || c.challenged_name || 'Challenge'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-[var(--card)] text-[var(--text-3)]'}`}>{c.status}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--card)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[10px] text-[var(--text-3)]">
                        <span>{c.days_active || 0}/{c.duration_days || '?'} days</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
