"use client";
import React from "react";

const MEDAL = ["🥇", "🥈", "🥉"];
const RING  = ["ring-yellow-400", "ring-gray-300", "ring-orange-400"];
const GLOW  = ["text-yellow-400", "text-gray-300", "text-orange-400"];

export function PodiumCard({ rank, user, onClick }) {
  const medal = MEDAL[rank - 1];
  const ring  = RING[rank - 1];
  const glow  = GLOW[rank - 1];
  const score = Math.round(user.score || 0);

  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-2 bg-gray-900 rounded-2xl p-4 active:scale-95 transition-transform"
    >
      <div className={`w-14 h-14 rounded-full ring-2 ${ring} flex items-center justify-center overflow-hidden bg-gray-800`}>
        {user.photo_path
          ? <img src={`/${user.photo_path}`} alt="" className="w-full h-full object-cover" />
          : <span className="text-xl">👤</span>}
      </div>
      <span className="text-lg">{medal}</span>
      <span className="text-sm font-bold text-white text-center leading-tight">{user.name}</span>
      <span className={`text-xs font-black tabular-nums ${glow}`}>{score} pts</span>
      {user.program_day && (
        <span className="text-[10px] text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">Day {user.program_day}</span>
      )}
    </button>
  );
}

export function RankRow({ rank, user, onClick }) {
  const score = Math.round(user.score || 0);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/60 active:bg-gray-800 transition-colors text-left"
    >
      <span className="w-6 text-center text-sm font-bold text-gray-500">{rank}</span>
      <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
        {user.photo_path
          ? <img src={`/${user.photo_path}`} alt="" className="w-full h-full object-cover" />
          : <span className="text-sm">👤</span>}
      </div>
      <span className="flex-1 text-sm font-semibold text-white">{user.name}</span>
      {user.program_day && (
        <span className="text-[10px] text-gray-600">Day {user.program_day}</span>
      )}
      <span className="text-sm font-bold text-emerald-400 tabular-nums">{score} pts</span>
    </button>
  );
}
