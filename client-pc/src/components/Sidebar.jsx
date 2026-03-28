import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Heart, Trophy, Users, Smartphone, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/pc/overview',     label: 'Overview',     icon: LayoutDashboard },
  { to: '/pc/training',     label: 'Training',     icon: Dumbbell },
  { to: '/pc/health',       label: 'Health',       icon: Heart },
  { to: '/pc/records',      label: 'Records',      icon: Trophy },
  { to: '/pc/leaderboard',  label: 'Leaderboard',  icon: Users },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'MT';

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--card)] h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[var(--border)]">
        <span className="text-2xl font-black text-[var(--accent)]">MT</span>
        <span className="text-xs text-[var(--text-3)] ml-2 font-medium">Dashboard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'text-[var(--text-2)] hover:text-white hover:bg-[var(--card-2)]'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
        {user?.is_admin === 1 && (
          <NavLink to="/pc/admin/users"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'text-[var(--text-2)] hover:text-white hover:bg-[var(--card-2)]'
              }`
            }
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Users
          </NavLink>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[var(--border)] flex flex-col gap-2">
        <a href="/dashboard" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-2)] hover:text-white hover:bg-[var(--card-2)] transition-colors">
          <Smartphone className="w-4 h-4 shrink-0" />
          Mobile App
        </a>

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0">
            {user?.photo_path
              ? <img src={`/${user.photo_path}`} className="w-8 h-8 rounded-full object-cover" alt="" />
              : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{user?.name || 'User'}</div>
            <div className="text-[10px] text-[var(--text-3)] truncate">@{user?.username}</div>
          </div>
          <button onClick={handleLogout} className="text-[var(--text-3)] hover:text-[var(--danger)] transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
