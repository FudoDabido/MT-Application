'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ExerciseSelector from '../../../components/workout/ExerciseSelector.jsx';
import StrengthForm from '../../../components/workout/StrengthForm.jsx';
import CardioForm from '../../../components/workout/CardioForm.jsx';
import VideoUploader from '../../../components/workout/VideoUploader.jsx';
import { createLog } from '../../../api/logsApi.js';
import Card from '../../../design-system/Card.jsx';
import Button from '../../../design-system/Button.jsx';

export default function LogWorkoutPage() {
  const router = useRouter();
  const [exercise,     setExercise]     = useState(null);
  const [strengthVals, setStrengthVals] = useState({ sets: '', reps: '' });
  const [cardioVals,   setCardioVals]   = useState({ distance_km: '', duration_min: '' });
  const [notes,        setNotes]        = useState('');
  const [videoFile,    setVideoFile]    = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!exercise) return setError('Select an exercise');
    setLoading(true); setError('');

    const fd = new FormData();
    fd.append('exercise_type_id', exercise.id);
    if (exercise.category === 'strength') {
      if (strengthVals.sets) fd.append('sets', strengthVals.sets);
      if (strengthVals.reps) fd.append('reps', strengthVals.reps);
    } else {
      if (cardioVals.distance_km) fd.append('distance_km', cardioVals.distance_km);
      if (cardioVals.duration_min) fd.append('duration_secs', parseInt(cardioVals.duration_min) * 60);
    }
    if (notes) fd.append('notes', notes);
    if (videoFile) fd.append('video', videoFile);

    try {
      await createLog(fd);
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log workout');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <h1 className="text-2xl font-bold text-white">Log Workout</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Exercise</p>
          <ExerciseSelector value={exercise} onChange={setExercise} />
        </Card>

        {exercise && (
          <Card>
            <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">
              {exercise.category === 'cardio' ? 'Cardio Details' : 'Strength Details'}
            </p>
            {exercise.category === 'cardio'
              ? <CardioForm values={cardioVals} onChange={setCardioVals} />
              : <StrengthForm values={strengthVals} onChange={setStrengthVals} />
            }
          </Card>
        )}

        <Card className="flex flex-col gap-4">
          <VideoUploader onFile={setVideoFile} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Notes (optional)</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="How did it go?"
              className="bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </Card>

        {error && <p className="text-[var(--danger)] text-sm">{error}</p>}

        <Button type="submit" loading={loading} disabled={!exercise} fullWidth size="lg" className="rounded-2xl font-black text-lg">
          Log Workout ✓
        </Button>
      </form>

      <div className="h-2" />
    </div>
  );
}
