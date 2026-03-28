'use client';
import React, { useState } from 'react';
import Modal from './shared/Modal.jsx';
import Input from './shared/Input.jsx';
import Button from './shared/Button.jsx';
import { createCheckin } from '../api/checkinsApi.js';

export default function CheckinModal({ onClose }) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await createCheckin({ weight_kg: parseFloat(weight), height_cm: parseFloat(height) });
      onClose();
    } catch (err) {
      setError('Failed to save check-in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal closeable={false}>
      <h2 className="text-xl font-bold mb-2">Monthly Check-In</h2>
      <p className="text-gray-400 text-sm mb-4">Log your current weight and height for this month's progress tracking.</p>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Weight (kg)" type="number" step="0.1" min="1" value={weight} onChange={(e) => setWeight(e.target.value)} required />
        <Input label="Height (cm)" type="number" step="0.1" min="1" value={height} onChange={(e) => setHeight(e.target.value)} required />
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Submit Check-In'}</Button>
      </form>
    </Modal>
  );
}
