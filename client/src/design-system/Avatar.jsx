'use client';
import React from 'react';

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

export default function Avatar({ src, name, size = 'md', className = '' }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className={`${sizes[size]} rounded-full bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover" />
        : <span className="font-bold text-[var(--accent)]">{initials}</span>
      }
    </div>
  );
}
