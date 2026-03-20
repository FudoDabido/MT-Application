import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseSelector from '../components/workout/ExerciseSelector.jsx';
import StrengthForm from '../components/workout/StrengthForm.jsx';
import CardioForm from '../components/workout/CardioForm.jsx';
import VideoUploader from '../components/workout/VideoUploader.jsx';
import Input from '../components/shared/Input.jsx';
import Button from '../components/shared/Button.jsx';
import { createLog } from '../api/logsApi.js';

export default function LogWorkoutPage() {
  const navigate = useNavigate();
  const [exercise, setExercise] = useState(null);
  const [strengthVals, setStrengthVals] = useState({ sets: '', reps: '' });
  const [cardioVals, setCardioVals] = useState({ distance_km: '', duration_min: '' });
  const [notes, setNotes] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!exercise) return setError('Select an exercise');
    setLoading(true);
    setError('');

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
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log workout');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Log Workout</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Exercise</h2>
          <ExerciseSelector value={exercise} onChange={setExercise} />
        </div>

        {exercise && (
          <div className="bg-gray-900 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
              {exercise.category === 'cardio' ? 'Cardio Details' : 'Strength Details'}
            </h2>
            {exercise.category === 'cardio'
              ? <CardioForm values={cardioVals} onChange={setCardioVals} />
              : <StrengthForm values={strengthVals} onChange={setStrengthVals} />
            }
          </div>
        )}

        <div className="bg-gray-900 rounded-xl p-5 flex flex-col gap-4">
          <VideoUploader onFile={setVideoFile} />
          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it go?" />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button type="submit" disabled={loading || !exercise} className="w-full">
          {loading ? 'Logging...' : 'Log Workout'}
        </Button>
      </form>
    </div>
  );
}
