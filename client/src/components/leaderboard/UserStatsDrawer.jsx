'use client';
import React, { useEffect, useState } from 'react';
import { getUserStats } from '../../api/leaderboardApi.js';

function fmtRecord(rec) {
  const parts = [];
  if (rec.best_weight_kg)    parts.push(`${rec.best_weight_kg} kg`);
  if (rec.best_reps)         parts.push(`${rec.best_reps} reps`);
  if (rec.best_sets)         parts.push(`${rec.best_sets} sets`);
  if (rec.best_distance_km)  parts.push(`${rec.best_distance_km} km`);
  if (rec.best_duration_secs) {
    const mins = Math.round(rec.best_duration_secs / 60);
    parts.push(`${mins} min`);
  }
  return parts.join(' · ') || '—';
}

function StatBox({ icon, label, value, color }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xl">{icon}</span>
      <span className={`text-2xl font-black tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

export default function UserStatsDrawer({ userId, rank, onClose }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getUserStats(userId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;

  const MEDAL = ['🥇', '🥈', '🥉'];
  const rankLabel = rank <= 3 ? MEDAL[rank - 1] : `#${rank}`;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950 rounded-t-3xl border-t border-gray-800 max-h-[85dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-gray-500 text-sm">Failed to load stats.</div>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-5 px-5 pb-8 pt-2">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                {data.user.photo_path
                  ? <img src={`/${data.user.photo_path}`} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl">👤</span>}
              </div>
              <div className="flex-1">
                <div className="text-lg font-black text-white">{data.user.name}</div>
                <div className="text-sm text-gray-400">{rankLabel} on leaderboard</div>
              </div>
              <button onClick={onClose} className="text-gray-500 text-xl px-2">✕</button>
            </div>

            {/* 60-Day Program */}
            {data.program_day && (
              <div className="bg-gray-900 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">60-Day Program</span>
                  <span className="text-sm font-black text-emerald-400">Day {data.program_day} / 60</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(data.program_day / 60) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatBox icon="💪" label="Exercises Done"  value={data.stats.total_exercises} color="text-emerald-400" />
              <StatBox icon="❌" label="Training Fails"  value={data.stats.fails}            color="text-red-400" />
              <StatBox icon="⏰" label="Times Late"      value={(data.stats.late_training || 0) + (data.stats.late_wake || 0)} color="text-yellow-400" />
              <StatBox icon="🏆" label="Records Set"     value={data.stats.records_count}   color="text-purple-400" />
            </div>

            {/* Training breakdown */}
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Training</div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Days checked in</span>
                <span className="font-bold text-white">{data.stats.completed} / {data.stats.total_days}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-400">Late wake-ups</span>
                <span className="font-bold text-yellow-400">{data.stats.late_wake}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-400">Late training</span>
                <span className="font-bold text-yellow-400">{data.stats.late_training}</span>
              </div>
            </div>

            {/* Personal Records */}
            {data.records.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Personal Records</div>
                <div className="bg-gray-900 rounded-2xl overflow-hidden divide-y divide-gray-800">
                  {data.records.map(rec => (
                    <div key={rec.id} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-white">{rec.exercise_name}</span>
                      <span className="text-sm font-bold text-emerald-400">{fmtRecord(rec)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
