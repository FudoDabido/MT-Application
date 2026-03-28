'use client';
import React from 'react';
import { Monitor } from 'lucide-react';

export default function WebOnlyPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-[var(--card-2)] border border-[var(--border)] flex items-center justify-center">
        <Monitor className="w-8 h-8 text-[var(--accent)]" />
      </div>
      <div>
        <div className="text-lg font-black text-white mb-1">{title}</div>
        <p className="text-sm text-[var(--text-3)] leading-relaxed">
          This section is available on the web dashboard.
        </p>
      </div>
      <a
        href="https://raspberrypi.tail037647.ts.net/pc/overview"
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2.5 bg-[var(--accent)] text-black text-sm font-bold rounded-xl"
      >
        Open Dashboard
      </a>
    </div>
  );
}
