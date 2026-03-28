'use client';
import React from 'react';
import TodaySummary from '../components/dashboard/TodaySummary.jsx';
import WeeklyChart from '../components/dashboard/WeeklyChart.jsx';
import ConsistencyScore from '../components/dashboard/ConsistencyScore.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back, {user?.name}!</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Today's Activity</h2>
          <TodaySummary />
        </div>
        <div className="bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Monthly Consistency</h2>
          <ConsistencyScore />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Weekly Activity (Reps)</h2>
        <WeeklyChart />
      </div>
    </div>
  );
}
