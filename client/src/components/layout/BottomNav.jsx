'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarClock, Trophy, User, Menu } from 'lucide-react';

const tabs = [
  { href: '/dashboard',   label: 'Today',    Icon: Home         },
  { href: '/schedule',    label: 'Schedule', Icon: CalendarClock },
  { href: '/leaderboard', label: 'Ranking',  Icon: Trophy       },
  { href: '/profile',     label: 'Me',       Icon: User         },
];

const MENU_PAGES = ['/game-plan', '/chess-board', '/stats-hub'];

export default function BottomNav({ onMenuOpen }) {
  const pathname = usePathname();
  const menuActive = MENU_PAGES.some(p => pathname.startsWith(p));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--card)] border-t border-[var(--border)] flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors"
          >
            <Icon
              className={`w-5 h-5 transition-colors ${active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className={`text-[10px] font-medium transition-colors ${active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}>
              {label}
            </span>
          </Link>
        );
      })}
      <button
        onClick={onMenuOpen}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors"
      >
        <Menu
          className={`w-5 h-5 transition-colors ${menuActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}
          strokeWidth={menuActive ? 2.5 : 1.8}
        />
        <span className={`text-[10px] font-medium transition-colors ${menuActive ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}>
          Menu
        </span>
      </button>
    </nav>
  );
}
