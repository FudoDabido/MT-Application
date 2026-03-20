import React from 'react';

export default function LeaderboardRow({ rank, user }) {
  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];
  const rankColor = rank <= 3 ? medalColors[rank - 1] : 'text-gray-500';

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
      <td className={`px-4 py-3 font-bold text-lg ${rankColor}`}>{rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {user.photo_path
            ? <img src={`/${user.photo_path}`} alt="" className="w-7 h-7 rounded-full object-cover" />
            : <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs">👤</div>
          }
          <span className="font-medium text-sm">{user.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-center text-emerald-400">{user.days_active}</td>
      <td className="px-4 py-3 text-sm text-center text-gray-300">{user.total_logs}</td>
      <td className="px-4 py-3 text-sm text-center text-gray-300">{user.total_reps || 0}</td>
    </tr>
  );
}
