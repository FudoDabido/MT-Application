'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';
import { register as registerApi } from '../../../api/authApi.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import Input from '../../../design-system/Input.jsx';
import Button from '../../../design-system/Button.jsx';

function PasswordStrength({ password }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const colors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1 flex-1">
        {[0,1,2,3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : 'bg-[var(--border)]'}`} />
        ))}
      </div>
      <span className="text-xs text-[var(--text-2)]">{labels[score - 1] || ''}</span>
    </div>
  );
}

const STEPS = ['Account', 'Security', 'Body'];

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', username: '', email: '',
    password: '', birth_date: '',
    initial_weight: '', initial_height: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const update = field => e => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: '' }));
  };

  function validateStep(s) {
    const errs = {};
    if (s === 0) {
      if (!form.name.trim()) errs.name = 'Required';
      if (!form.username.trim()) errs.username = 'Required';
      else if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username)) errs.username = '3–30 chars, letters/numbers/_';
      if (!form.email.trim()) errs.email = 'Required';
    }
    if (s === 1) {
      if (!form.password) errs.password = 'Required';
      else if (form.password.length < 6) errs.password = 'Min. 6 characters';
      if (!form.birth_date) errs.birth_date = 'Required';
    }
    return errs;
  }

  function nextStep() {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setStep(s => s + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        initial_weight: parseFloat(form.initial_weight) || undefined,
        initial_height: parseFloat(form.initial_height) || undefined,
      };
      const res = await registerApi(payload);
      login(res.data.token, res.data.user);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] flex flex-col px-5"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', paddingBottom: '32px' }}>
      <Toaster position="top-center" toastOptions={{
        style: { background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '14px' }
      }} />

      {/* Back + Logo */}
      <div className="flex items-center gap-3 mb-8">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)} className="text-[var(--text-2)] p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <Link href="/login" className="text-[var(--text-2)] p-1">
            <ChevronLeft className="w-6 h-6" />
          </Link>
        )}
        <div className="text-2xl font-black text-[var(--accent)]">MT</div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
        ))}
      </div>

      <h1 className="text-2xl font-black text-white mb-1">{STEPS[step]}</h1>
      <p className="text-[var(--text-2)] text-sm mb-6">
        {step === 0 && 'Create your identity'}
        {step === 1 && 'Secure your account'}
        {step === 2 && 'Optional body metrics (can skip)'}
      </p>

      <form onSubmit={step === 2 ? handleSubmit : e => { e.preventDefault(); nextStep(); }} className="flex flex-col gap-4 flex-1">
        {step === 0 && (
          <>
            <Input label="Full Name" value={form.name} onChange={update('name')} error={errors.name} placeholder="David Garcia" autoFocus />
            <Input label="Username" value={form.username} onChange={update('username')} error={errors.username} placeholder="fudo_47" />
            <Input label="Email" type="email" value={form.email} onChange={update('email')} error={errors.email} placeholder="you@example.com" />
          </>
        )}
        {step === 1 && (
          <>
            <div>
              <Input label="Password" type="password" value={form.password} onChange={update('password')} error={errors.password} placeholder="Min. 6 characters" autoFocus />
              <PasswordStrength password={form.password} />
            </div>
            <Input label="Date of Birth" type="date" value={form.birth_date} onChange={update('birth_date')} error={errors.birth_date} />
          </>
        )}
        {step === 2 && (
          <>
            <Input label="Weight (kg)" type="number" step="0.1" value={form.initial_weight} onChange={update('initial_weight')} placeholder="75" />
            <Input label="Height (cm)" type="number" step="0.1" value={form.initial_height} onChange={update('initial_height')} placeholder="178" />
          </>
        )}

        <div className="mt-auto pt-4">
          <Button type="submit" fullWidth size="lg" loading={loading}>
            {step < 2 ? 'Continue' : "Start your journey"}
          </Button>
          {step === 2 && (
            <button type="submit" className="w-full mt-3 text-[var(--text-3)] text-sm py-2">
              Skip for now
            </button>
          )}
        </div>
      </form>

      {step === 0 && (
        <p className="text-center text-sm text-[var(--text-2)] mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--accent)] font-medium">Sign in</Link>
        </p>
      )}
    </div>
  );
}
