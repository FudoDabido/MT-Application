import React, { useState, useEffect } from 'react';
import Input from '../shared/Input.jsx';
import Button from '../shared/Button.jsx';
import { updateUser } from '../../api/usersApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProfileForm() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: '', birth_date: '', initial_weight: '', initial_height: '' });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form whenever user object updates (e.g. after program setup saves weight/height)
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        birth_date: user.birth_date || '',
        initial_weight: user.initial_weight || '',
        initial_height: user.initial_height || '',
      });
    }
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateUser(user.id, {
        name: form.name,
        birth_date: form.birth_date || null,
        initial_weight: parseFloat(form.initial_weight) || null,
        initial_height: parseFloat(form.initial_height) || null,
      });
      await refreshUser(); // re-fetch from DB so context stays in sync
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <Input label="Birth Date" type="date" value={form.birth_date} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} />
      <Input label="Weight (kg)" type="number" step="0.1" value={form.initial_weight} onChange={(e) => setForm((f) => ({ ...f, initial_weight: e.target.value }))} placeholder="e.g. 80.5" />
      <Input label="Height (cm)" type="number" step="0.1" value={form.initial_height} onChange={(e) => setForm((f) => ({ ...f, initial_height: e.target.value }))} placeholder="e.g. 175" />
      <Button type="submit" disabled={loading}>{saved ? '✓ Saved!' : loading ? 'Saving...' : 'Save Changes'}</Button>
    </form>
  );
}
