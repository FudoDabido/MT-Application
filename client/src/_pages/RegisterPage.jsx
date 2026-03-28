'use client';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as registerApi } from '../api/authApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import Input from '../components/shared/Input.jsx';
import Button from '../components/shared/Button.jsx';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '', birth_date: '', initial_weight: '', initial_height: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.username.trim()) errs.username = 'Required';
    else if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username)) errs.username = '3–30 chars, letters/numbers/underscores only';
    if (!form.email.trim()) errs.email = 'Required';
    if (!form.password) errs.password = 'Required';
    else if (form.password.length < 6) errs.password = 'Min. 6 characters';
    if (!form.birth_date) errs.birth_date = 'Required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setServerError('');
    try {
      const payload = {
        ...form,
        initial_weight: parseFloat(form.initial_weight) || undefined,
        initial_height: parseFloat(form.initial_height) || undefined,
      };
      const res = await registerApi(payload);
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl font-black text-emerald-400 mb-2">MT</div>
          <div className="text-gray-400 text-sm">Create your account</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-6">
          <h1 className="text-xl font-bold text-white mb-6">Register</h1>
          {serverError && (
            <div className="bg-red-900/40 text-red-300 text-sm px-3 py-2 rounded-lg mb-4">{serverError}</div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full Name" value={form.name} onChange={update('name')} error={errors.name} placeholder="e.g. John Doe" autoFocus />
            <Input label="Username" value={form.username} onChange={update('username')} error={errors.username} placeholder="e.g. fudo_47" />
            <Input label="Email" type="email" value={form.email} onChange={update('email')} error={errors.email} placeholder="you@example.com" />
            <Input label="Password" type="password" value={form.password} onChange={update('password')} error={errors.password} placeholder="Min. 6 characters" />
            <Input label="Date of Birth" type="date" value={form.birth_date} onChange={update('birth_date')} error={errors.birth_date} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Weight (kg)" type="number" step="0.1" value={form.initial_weight} onChange={update('initial_weight')} placeholder="Optional" />
              <Input label="Height (cm)" type="number" step="0.1" value={form.initial_height} onChange={update('initial_height')} placeholder="Optional" />
            </div>
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            Have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
