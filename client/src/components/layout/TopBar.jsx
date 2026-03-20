import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh   = String(now.getHours()).padStart(2, '0');
  const mm   = String(now.getMinutes()).padStart(2, '0');
  const ss   = String(now.getSeconds()).padStart(2, '0');
  const day  = DAYS[now.getDay()];
  const date = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  return (
    <div className="flex flex-col items-center leading-tight select-none">
      <span className="text-base font-black text-white tabular-nums tracking-tight">
        {hh}:{mm}<span className="text-gray-500">:{ss}</span>
      </span>
      <span className="text-[10px] text-gray-500">{day} · {date}</span>
    </div>
  );
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const src      = user?.photo_path ? `/${user.photo_path}` : null;
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
      {/* Live clock — center */}
      <div className="flex-1 flex justify-start">
        <div className="text-sm text-gray-500">Move Tracker</div>
      </div>

      <LiveClock />

      {/* User info — right */}
      <div className="flex-1 flex items-center justify-end gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-700 flex items-center justify-center shrink-0 border border-gray-700">
          {src
            ? <img src={src} alt="avatar" className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-white">{initials}</span>}
        </div>
        <span className="text-sm font-medium text-white">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
