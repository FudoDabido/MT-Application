import React from 'react';
import LeaderboardRow from './LeaderboardRow.jsx';

export default function LeaderboardTable({ users }) {
  if (!users.length) return <p className="text-gray-500 text-sm text-center py-8">No data yet this month.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="px-4 py-2 text-left">#</th>
            <th className="px-4 py-2 text-left">Athlete</th>
            <th className="px-4 py-2 text-center">Days Active</th>
            <th className="px-4 py-2 text-center">Sessions</th>
            <th className="px-4 py-2 text-center">Total Reps</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => <LeaderboardRow key={user.id} rank={i + 1} user={user} />)}
        </tbody>
      </table>
    </div>
  );
}
