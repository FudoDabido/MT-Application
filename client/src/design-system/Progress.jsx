'use client';
import React from 'react';

const colors = {
  emerald: 'bg-[var(--accent)]',
  yellow:  'bg-[var(--warning)]',
  red:     'bg-[var(--danger)]',
  blue:    'bg-blue-400',
  gray:    'bg-[var(--text-3)]',
};

const heights = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export default function Progress({ value = 0, color = 'emerald', size = 'md', label, className = '' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs text-[var(--text-2)]">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={`w-full ${heights[size]} bg-[var(--card-2)] rounded-full overflow-hidden`}>
        <div
          className={`${heights[size]} ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
