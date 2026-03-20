import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../api/leaderboardApi.js';
import LeaderboardTable from '../components/leaderboard/LeaderboardTable.jsx';
import Spinner from '../components/shared/Spinner.jsx';

export default function LeaderboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard().then((r) => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-gray-400 text-sm mt-1">{monthName}</p>
      </div>
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner /></div> : <LeaderboardTable users={users} />}
      </div>
    </div>
  );
}
