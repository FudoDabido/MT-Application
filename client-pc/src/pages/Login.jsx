import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { login } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { setToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await login(form);
      setToken(res.data.token, res.data.user);
      navigate('/pc/overview');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl font-black text-[var(--accent)] mb-2">MT</div>
          <div className="text-[var(--text-3)] text-sm">PC Dashboard — Discipline Analytics</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--card)] rounded-2xl p-6 flex flex-col gap-4 border border-[var(--border)]">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Email</label>
            <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
              placeholder="you@example.com" autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Password</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="••••••••" />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-white transition-colors">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-[var(--danger)] text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-opacity mt-1">
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  );
}
