import React, { useState, useEffect } from 'react';
import { listUsers, createUser } from '../api/index.js';
import { UserPlus, X, Eye, EyeOff } from 'lucide-react';

export default function AdminUsers() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ name: '', username: '', email: '', password: '' });
  const [showPw,   setShowPw]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [created,  setCreated]  = useState(null);

  async function load() {
    setLoading(true);
    try { const r = await listUsers(); setUsers(r.data || []); } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ name: '', username: '', email: '', password: '' });
    setError(''); setCreated(null); setShowPw(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const r = await createUser(form);
      setCreated(r.data.user);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally { setSaving(false); }
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Users</h1>
        <button onClick={() => { setShowForm(f => !f); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
          {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 max-w-md">
          <div className="text-sm font-semibold text-white mb-4">New User</div>
          {created ? (
            <div className="flex flex-col gap-3">
              <div className="p-4 bg-emerald-900/30 border border-emerald-800 rounded-xl">
                <div className="text-emerald-400 font-bold text-sm mb-2">User created successfully</div>
                <div className="text-xs text-[var(--text-2)] space-y-1">
                  <div><span className="text-[var(--text-3)]">Name:</span> {created.name}</div>
                  <div><span className="text-[var(--text-3)]">Username:</span> @{created.username}</div>
                  <div><span className="text-[var(--text-3)]">Email:</span> {created.email}</div>
                </div>
              </div>
              <button onClick={() => { resetForm(); setShowForm(false); }}
                className="px-4 py-2 bg-[var(--card-2)] text-white text-sm font-medium rounded-xl hover:bg-[var(--border)] transition-colors">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              {[
                { key: 'name',     label: 'Full Name',  type: 'text' },
                { key: 'username', label: 'Username',   type: 'text' },
                { key: 'email',    label: 'Email',      type: 'email' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs text-[var(--text-3)] mb-1 block">{label}</label>
                  <input type={type} value={form[key]} required
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
                </div>
              ))}
              <div>
                <label className="text-xs text-[var(--text-3)] mb-1 block">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password} required
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-white">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="text-xs text-[var(--danger)]">{error}</div>}
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-[var(--accent)] text-black text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-3)] text-sm">Loading…</div>
        ) : !users.length ? (
          <div className="p-8 text-center text-[var(--text-3)] text-sm">No users yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Name', 'Username', 'Email', 'Role', 'Joined'].map(h => (
                  <th key={h} className="py-3 px-4 text-left text-xs text-[var(--text-3)] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--card-2)] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[var(--card-2)] flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0 overflow-hidden">
                        {u.photo_path ? <img src={`/uploads/${u.photo_path}`} className="w-full h-full object-cover" alt="" /> : (u.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      <span className="text-white font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--text-2)]">@{u.username}</td>
                  <td className="py-3 px-4 text-[var(--text-2)]">{u.email}</td>
                  <td className="py-3 px-4">
                    {u.is_admin
                      ? <span className="text-[10px] px-2 py-0.5 bg-amber-900/40 text-amber-400 font-bold rounded-full">Admin</span>
                      : <span className="text-[10px] px-2 py-0.5 bg-[var(--card-2)] text-[var(--text-3)] font-bold rounded-full">User</span>}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-3)] text-xs">{u.created_at ? u.created_at.slice(0,10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
