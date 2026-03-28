'use client';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login as loginApi } from '../api/authApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import Input from '../components/shared/Input.jsx';
import Button from '../components/shared/Button.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginApi(form);
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl font-black text-emerald-400 mb-2">MT</div>
          <div className="text-gray-400 text-sm">Move Tracker — Track every rep</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-6">
          <h1 className="text-xl font-bold mb-6">Sign In</h1>
          {error && <div className="bg-red-900/40 text-red-300 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Username" type="text" autoComplete="username" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required autoFocus />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            <Button type="submit" disabled={loading} className="w-full mt-2">{loading ? 'Signing in...' : 'Sign In'}</Button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            No account? <Link to="/register" className="text-emerald-400 hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
