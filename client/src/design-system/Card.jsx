'use client';
import React from 'react';

export default function Card({ children, className = '', onClick, elevated = false }) {
  const base = elevated ? 'bg-[var(--card-2)]' : 'bg-[var(--card)]';
  const press = onClick ? 'active:scale-[0.98] cursor-pointer transition-transform' : '';
  return (
    <div
      className={`${base} rounded-2xl p-4 ${press} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
