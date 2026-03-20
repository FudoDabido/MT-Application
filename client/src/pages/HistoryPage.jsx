import React, { useEffect, useState } from 'react';
import { getLogs } from '../api/logsApi.js';
import { getExercises } from '../api/exercisesApi.js';
import Badge from '../components/shared/Badge.jsx';
import Spinner from '../components/shared/Spinner.jsx';

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExercises().then((r) => setExercises(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = filter ? { exercise_type_id: filter } : {};
    getLogs(params).then((r) => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History</h1>
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All exercises</option>
          {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !logs.length ? (
        <p className="text-gray-500 text-sm">No workouts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => (
            <div key={log.id} className="bg-gray-900 rounded-xl p-4 flex gap-4">
              {log.video_path && (
                <video src={`/${log.video_path}`} className="w-20 h-16 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{log.exercise_name}</span>
                  <Badge type={log.category}>{log.category}</Badge>
                </div>
                <div className="text-xs text-gray-400 flex flex-wrap gap-3">
                  {log.reps ? <span>{log.reps} reps</span> : null}
                  {log.sets ? <span>{log.sets} sets</span> : null}
                  {log.distance_km ? <span>{log.distance_km} km</span> : null}
                  {log.duration_secs ? <span>{Math.round(log.duration_secs / 60)} min</span> : null}
                </div>
                {log.notes && <p className="text-xs text-gray-500 mt-1 truncate">{log.notes}</p>}
                <div className="text-xs text-gray-600 mt-1">{new Date(log.logged_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
