'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarClock, Trophy, User } from 'lucide-react';

const tabs = [
  { href: '/dashboard',   label: 'Today',    Icon: Home         },
  { href: '/schedule',    label: 'Schedule', Icon: CalendarClock },
  { href: '/leaderboard', label: 'Ranking',  Icon: Trophy       },
  { href: '/profile',     label: 'Me',       Icon: User         },
];

export default function BottomNav() {
  const pathname = usePathname();

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
    </nav>
  );
}
