import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ label, value, unit = '', trend, color = 'var(--accent)', icon, sub, loading }) {
  const trendNum = Number(trend);
  return (
    <div className="bg-[var(--card)] rounded-2xl p-5 flex flex-col gap-1">
      {icon && <div className="text-[var(--text-3)] mb-1">{icon}</div>}
      {loading ? (
        <div className="h-9 w-24 bg-[var(--card-2)] rounded-lg animate-pulse" />
      ) : (
        <div className="flex items-end gap-1.5">
          <span className="text-3xl font-black tabular-nums leading-none" style={{ color }}>{value ?? '—'}</span>
          {unit && <span className="text-sm font-semibold text-[var(--text-3)] mb-0.5">{unit}</span>}
        </div>
      )}
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">{label}</span>
        {trend != null && !isNaN(trendNum) && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${trendNum > 0 ? 'text-emerald-400' : trendNum < 0 ? 'text-red-400' : 'text-[var(--text-3)]'}`}>
            {trendNum > 0 ? <TrendingUp className="w-3 h-3" /> : trendNum < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {trendNum > 0 ? '+' : ''}{trendNum}%
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-[var(--text-3)]">{sub}</div>}
    </div>
  );
}
