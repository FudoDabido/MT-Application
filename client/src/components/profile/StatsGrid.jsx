import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function StatsGrid() {
  const { user } = useAuth();
  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—';

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard label="Weight" value={user?.initial_weight ? `${user.initial_weight} kg` : '—'} />
      <StatCard label="Height" value={user?.initial_height ? `${user.initial_height} cm` : '—'} />
      <StatCard label="Member Since" value={joined} />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 text-center">
      <div className="text-lg font-bold text-emerald-400">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
