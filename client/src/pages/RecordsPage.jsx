import React, { useEffect, useState } from 'react';
import { getRecords } from '../api/recordsApi.js';
import Badge from '../components/shared/Badge.jsx';
import Spinner from '../components/shared/Spinner.jsx';

export default function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecords().then((r) => setRecords(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Personal Records</h1>
      {!records.length ? (
        <p className="text-gray-500 text-sm">No records yet. Log some workouts!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {records.map((rec) => (
            <div key={rec.id} className="bg-gray-900 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{rec.exercise_name}</span>
                <Badge type={rec.category}>{rec.category}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {rec.best_reps && <Stat label="Best Reps" value={rec.best_reps} />}
                {rec.best_sets && <Stat label="Best Sets" value={rec.best_sets} />}
                {rec.best_distance_km && <Stat label="Best Distance" value={`${rec.best_distance_km} km`} />}
                {rec.best_duration_secs && <Stat label="Best Time" value={`${Math.round(rec.best_duration_secs / 60)} min`} />}
              </div>
              <div className="text-xs text-gray-600 mt-3">{new Date(rec.achieved_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2 text-center">
      <div className="text-emerald-400 font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
