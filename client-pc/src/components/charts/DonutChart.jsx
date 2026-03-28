import React from 'react';

export default function DonutChart({ segments = [], size = 160, label = '' }) {
  if (!segments.length || segments.every(s => !s.value)) {
    return <div style={{ width: size, height: size }} className="flex items-center justify-center text-[var(--text-3)] text-xs">No data</div>;
  }
  const total = segments.reduce((s, d) => s + (d.value || 0), 0);
  if (!total) return null;

  const cx = 50, cy = 50, r = 38, inner = 24;
  let angle = -90;

  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const sweep = pct * 360;
    const startA = angle;
    angle += sweep;
    const endA = angle;
    const toRad = a => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startA));
    const y1 = cy + r * Math.sin(toRad(startA));
    const x2 = cx + r * Math.cos(toRad(endA));
    const y2 = cy + r * Math.sin(toRad(endA));
    const xi1 = cx + inner * Math.cos(toRad(startA));
    const yi1 = cy + inner * Math.sin(toRad(startA));
    const xi2 = cx + inner * Math.cos(toRad(endA));
    const yi2 = cy + inner * Math.sin(toRad(endA));
    const large = sweep > 180 ? 1 : 0;
    return { ...seg, pct, path: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z` };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
        {arcs.map((seg, i) => (
          <path key={i} d={seg.path} fill={seg.color} opacity="0.9">
            <title>{seg.label}: {Math.round(seg.pct * 100)}%</title>
          </path>
        ))}
        <text x="50" y="47" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">{label}</text>
        <text x="50" y="56" textAnchor="middle" fontSize="5" fill="#4b5563">total</text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[var(--text-2)]">{seg.label}</span>
            <span className="text-white font-semibold">{seg.value}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}
