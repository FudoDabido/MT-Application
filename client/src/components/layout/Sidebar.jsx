import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getTodaySession } from '../../api/meditationApi.js';

const links = [
  { to: '/dashboard',   label: 'Dashboard',       icon: '🏠' },
  { to: '/program',     label: '60-Day Program',   icon: '🎯' },
  { to: '/log',         label: 'Log Workout',      icon: '➕' },
  { to: '/history',     label: 'History',          icon: '📋' },
  { to: '/calendar',    label: 'Calendar',         icon: '📅' },
  { to: '/records',     label: 'Records',          icon: '🏆' },
  { to: '/leaderboard', label: 'Leaderboard',      icon: '📊' },
  { to: '/profile',     label: 'Profile',          icon: '👤' },
];

export default function Sidebar() {
  const [meditationStatus, setMeditationStatus] = useState(null); // null | 'active' | 'passed' | 'failed'

  useEffect(() => {
    getTodaySession()
      .then(res => {
        const s = res.data.session;
        setMeditationStatus(s ? s.status : 'none');
      })
      .catch(() => {});
  }, []);

  const meditationDot =
    meditationStatus === 'passed'  ? 'bg-emerald-400' :
    meditationStatus === 'active'  ? 'bg-yellow-400 animate-pulse' :
    meditationStatus === 'failed'  ? 'bg-red-500' : null;

  return (
    <aside className="w-56 bg-gray-900 flex flex-col py-6 px-4 gap-1 shrink-0">
      <div className="text-2xl font-black text-emerald-400 mb-6 px-2">MT</div>

      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`
          }
        >
          <span>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}

      {/* Meditate — separate with divider */}
      <div className="border-t border-gray-800 mt-2 pt-2">
        <NavLink
          to="/meditate"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`
          }
        >
          <span>🧘</span>
          <span className="flex-1">Meditate</span>
          {meditationDot && (
            <span className={`w-2 h-2 rounded-full ${meditationDot}`} />
          )}
        </NavLink>
      </div>
    </aside>
  );
}
