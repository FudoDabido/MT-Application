'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import { login as loginApi } from '../../../api/authApi.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import Input from '../../../design-system/Input.jsx';
import Button from '../../../design-system/Button.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginApi(form);
      login(res.data.token, res.data.user);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] flex flex-col px-5 pt-safe"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}>
      <Toaster position="top-center" toastOptions={{
        style: { background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '14px' }
      }} />

      {/* Logo */}
      <div className="flex-1 flex flex-col items-center justify-center pb-8">
        <div className="text-6xl font-black text-[var(--accent)] tracking-tighter mb-2">MT</div>
        <p className="text-[var(--text-3)] text-sm">Move Tracker — Track every rep</p>
      </div>

      {/* Form */}
      <div className="bg-[var(--card)] rounded-3xl p-6 mb-6">
        <h1 className="text-xl font-bold text-white mb-6">Sign In</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Username or Email"
            type="text"
            autoComplete="username"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="your_username"
            required
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
            required
          />
          <Button type="submit" loading={loading} fullWidth size="lg" className="mt-2">
            Sign In
          </Button>
        </form>
        <p className="text-center text-sm text-[var(--text-2)] mt-5">
          No account?{' '}
          <Link href="/register" className="text-[var(--accent)] font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
