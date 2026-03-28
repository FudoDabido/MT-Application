'use client';
import React, { useEffect, useState } from 'react';
import { getTodaySummary } from '../../api/logsApi.js';
import Spinner from '../shared/Spinner.jsx';
import Badge from '../shared/Badge.jsx';

export default function TodaySummary() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTodaySummary().then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="sm" />;
  if (!data.length) return <p className="text-gray-500 text-sm">No workouts logged today. Get moving!</p>;

  return (
    <div className="flex flex-col gap-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{item.name}</span>
              <Badge type={item.category}>{item.category}</Badge>
            </div>
            <div className="text-xs text-gray-400 mt-1 flex gap-3">
              {item.total_reps ? <span>{item.total_reps} reps</span> : null}
              {item.total_sets ? <span>{item.total_sets} sets</span> : null}
              {item.total_distance_km ? <span>{item.total_distance_km.toFixed(2)} km</span> : null}
              {item.total_duration_secs ? <span>{Math.round(item.total_duration_secs / 60)} min</span> : null}
            </div>
          </div>
          <span className="text-xs text-gray-500">{item.log_count}x</span>
        </div>
      ))}
    </div>
  );
}
