'use client';
import React from 'react';

export default function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 bg-[var(--card-2)] p-1 rounded-xl ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={[
            'flex-1 h-9 rounded-lg text-sm font-medium transition-all',
            active === tab.value
              ? 'bg-[var(--card)] text-white shadow-sm'
              : 'text-[var(--text-2)] hover:text-white',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
