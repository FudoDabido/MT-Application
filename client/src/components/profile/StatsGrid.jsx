'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getPresenceStats } from '../../api/wakePresenceApi.js';
import { getTrainingStats } from '../../api/trainingCheckinApi.js';
import { getStretchStats } from '../../api/stretchCheckinApi.js';

export default function StatsGrid() {
  const { user } = useAuth();
  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
  const [presence, setPresence] = useState(null);
  const [training, setTraining] = useState(null);
  const [stretch, setStretch]   = useState(null);

  useEffect(() => {
    getPresenceStats().then(res => setPresence(res.data)).catch(() => {});
    getTrainingStats().then(res => setTraining(res.data)).catch(() => {});
    getStretchStats().then(res => setStretch(res.data)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Basic stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Weight" value={user?.initial_weight ? `${user.initial_weight} kg` : '—'} color="text-emerald-400" />
        <StatCard label="Height" value={user?.initial_height ? `${user.initial_height} cm` : '—'} color="text-emerald-400" />
        <StatCard label="Member Since" value={joined} color="text-emerald-400" />
      </div>

      {/* Wake presence scores */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">⏰ Wake Presence</div>
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Passed" value={presence?.passed ?? '—'} color="text-emerald-400" />
          <StatCard label="Failed" value={presence?.failed ?? '—'} color="text-red-400" />
          <StatCard label="Streak" value={presence ? `${presence.streak}d` : '—'} color="text-yellow-400" />
          <StatCard label="Best"   value={presence ? `${presence.best_streak}d` : '—'} color="text-blue-400" />
        </div>
      </div>

      {/* Training presence scores */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">💪 Training Presence</div>
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Passed" value={training?.passed ?? '—'} color="text-emerald-400" />
          <StatCard label="Failed" value={training?.failed ?? '—'} color="text-red-400" />
          <StatCard label="Streak" value={training ? `${training.streak}d` : '—'} color="text-yellow-400" />
          <StatCard label="Best"   value={training ? `${training.best_streak}d` : '—'} color="text-blue-400" />
        </div>
      </div>

      {/* Stretch presence scores */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">🤸 Stretching Presence</div>
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Passed" value={stretch?.passed ?? '—'} color="text-emerald-400" />
          <StatCard label="Failed" value={stretch?.failed ?? '—'} color="text-red-400" />
          <StatCard label="Streak" value={stretch ? `${stretch.streak}d` : '—'} color="text-yellow-400" />
          <StatCard label="Best"   value={stretch ? `${stretch.best_streak}d` : '—'} color="text-blue-400" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-emerald-400' }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
