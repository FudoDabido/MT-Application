'use client';
import React from 'react';

export default function Skeleton({ className = '' }) {
  return (
    <div className={`bg-[var(--card-2)] rounded-xl animate-pulse ${className}`} />
  );
}
