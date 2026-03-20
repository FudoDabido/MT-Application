import React, { useEffect, useState } from 'react';
import { getConsistency } from '../../api/logsApi.js';

export default function ConsistencyScore() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getConsistency().then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return null;

  const pct = data.days_elapsed > 0 ? Math.round((data.days_trained / data.days_elapsed) * 100) : 0;
  const color = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-4">
      <div className={`text-5xl font-black ${color}`}>{pct}%</div>
      <div className="text-sm text-gray-400">
        <div>{data.days_trained} of {data.days_elapsed} days this month</div>
        <div className="text-xs mt-0.5">{data.year_month}</div>
      </div>
    </div>
  );
}
