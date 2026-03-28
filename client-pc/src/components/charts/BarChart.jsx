import React from 'react';

export default function BarChart({ data = [], color = '#34d399', unit = '', height = 160, horizontal = false }) {
  if (!data.length) return <div style={{ height }} className="flex items-center justify-center text-[var(--text-3)] text-sm">No data</div>;

  const vals = data.map(d => Number(d.value));
  const max = Math.max(...vals, 1);

  if (horizontal) {
    return (
      <div className="flex flex-col gap-1.5" style={{ minHeight: height }}>
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="text-xs text-[var(--text-3)] w-24 shrink-0 truncate text-right">{d.label}</div>
            <div className="flex-1 bg-[var(--card-2)] rounded-full h-5 relative overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: d.color || color }} />
            </div>
            <div className="text-xs font-bold text-white w-16 shrink-0">{Math.round(d.value)}{unit}</div>
          </div>
        ))}
      </div>
    );
  }

  const W = 100, H = 100;
  const PAD = { t: 10, r: 4, b: 20, l: 4 };
  const barW = (W - PAD.l - PAD.r) / data.length - 2;

  return (
    <div style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
        {data.map((d, i) => {
          const bh = ((d.value / max) * (H - PAD.t - PAD.b));
          const bx = PAD.l + i * ((W - PAD.l - PAD.r) / data.length) + 1;
          const by = H - PAD.b - bh;
          return (
            <g key={i}>
              <rect x={bx} y={by} width={barW} height={bh} rx="1" fill={d.color || color} fillOpacity="0.9" />
              <text x={bx + barW / 2} y={by - 1.5} textAnchor="middle" fontSize="3.5" fill="#9ca3af">
                {d.value > 0 ? Math.round(d.value) : ''}
              </text>
              <text x={bx + barW / 2} y={H - 2} textAnchor="middle" fontSize="3" fill="#4b5563">
                {d.label?.length > 5 ? d.label.slice(0, 5) : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
