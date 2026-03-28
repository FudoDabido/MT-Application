'use client';
import React from 'react';

const styles = {
  success: 'bg-emerald-900/40 text-emerald-400 border border-emerald-800',
  warning: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  danger:  'bg-red-900/40 text-red-400 border border-red-800',
  neutral: 'bg-[var(--card-2)] text-[var(--text-2)] border border-[var(--border)]',
  blue:    'bg-blue-900/40 text-blue-400 border border-blue-800',
};

export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
