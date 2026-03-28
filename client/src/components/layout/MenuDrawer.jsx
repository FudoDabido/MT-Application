'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Target, Layout, BarChart2, Home, CalendarClock, Trophy, User, BookOpen, Dumbbell, Wind, Clock } from 'lucide-react';

const SECTIONS = [
  {
    label: 'My Apps',
    items: [
      { href: '/game-plan',  Icon: Target,   label: 'Game Plan',  desc: 'Live routine & check-ins' },
      { href: '/chess-board',Icon: Layout,   label: 'Chess Board',desc: 'Plan & log your sessions' },
      { href: '/stats-hub',  Icon: BarChart2,label: 'Stats Hub',  desc: 'Records, reps & discipline' },
    ],
  },
  {
    label: 'Daily',
    items: [
      { href: '/dashboard',  Icon: Home,         label: 'Today',    desc: 'Daily overview' },
      { href: '/schedule',   Icon: CalendarClock, label: 'Schedule', desc: 'Day plan & todos' },
      { href: '/training',   Icon: Dumbbell,      label: 'Training', desc: 'Workout check-in' },
      { href: '/meditate',   Icon: Wind,          label: 'Meditate', desc: 'Meditation session' },
      { href: '/stretch',    Icon: Clock,         label: 'Stretch',  desc: 'Stretch session' },
    ],
  },
  {
    label: 'Progress',
    items: [
      { href: '/leaderboard',Icon: Trophy,  label: 'Ranking',  desc: 'Leaderboard' },
      { href: '/diary',      Icon: BookOpen,label: 'Diary',    desc: 'Journal & lessons' },
      { href: '/profile',    Icon: User,    label: 'Profile',  desc: 'Your stats & settings' },
    ],
  },
];

export default function MenuDrawer({ open, onClose }) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        className="relative mt-auto w-full bg-[var(--bg)] rounded-t-3xl border-t border-[var(--border)] max-h-[85dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="sticky top-0 bg-[var(--bg)] px-5 pt-4 pb-3 border-b border-[var(--border)] flex items-center justify-between z-10">
          <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto absolute left-1/2 top-3 -translate-x-1/2" />
          <h2 className="text-base font-bold text-white mt-2">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[var(--card-2)] text-[var(--text-3)] active:opacity-70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-5 pb-8">
          {SECTIONS.map(section => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-widest mb-2 px-1">
                {section.label}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map(({ href, Icon, label, desc }) => {
                  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        active
                          ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/30'
                          : 'bg-[var(--card)] active:bg-[var(--card-2)]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        active ? 'bg-[var(--accent)]/20' : 'bg-[var(--card-2)]'
                      }`}>
                        <Icon
                          className={`w-4 h-4 ${active ? 'text-[var(--accent)]' : 'text-[var(--text-2)]'}`}
                          strokeWidth={active ? 2.5 : 2}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${active ? 'text-[var(--accent)]' : 'text-white'}`}>
                          {label}
                        </p>
                        <p className="text-[11px] text-[var(--text-3)] truncate">{desc}</p>
                      </div>
                      {active && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
