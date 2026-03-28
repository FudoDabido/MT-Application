import React, { useState } from 'react';

export default function LineChart({ data = [], color = '#34d399', unit = '', title = '', height = 180, showDots = true, fill = false }) {
  const [tooltip, setTooltip] = useState(null);
  if (!data.length) return <div style={{ height }} className="flex items-center justify-center text-[var(--text-3)] text-sm">No data</div>;

  const W = 100, H = 100;
  const PAD = { t: 8, r: 8, b: 24, l: 36 };
  const vals = data.map(d => Number(d.y));
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;

  const toX = i => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const toY = v => PAD.t + (1 - (v - min) / range) * (H - PAD.t - PAD.b);

  const pts = data.map((d, i) => `${toX(i)},${toY(Number(d.y))}`).join(' ');
  const fillPath = `M${toX(0)},${toY(Number(data[0].y))} ` +
    data.map((d, i) => `L${toX(i)},${toY(Number(d.y))}`).join(' ') +
    ` L${toX(data.length - 1)},${H - PAD.b} L${toX(0)},${H - PAD.b} Z`;

  // X-axis labels (show ~5)
  const step = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  // Y gridlines (4)
  const ySteps = 4;
  const yGrids = Array.from({ length: ySteps + 1 }, (_, i) => min + (range / ySteps) * i);

  return (
    <div className="relative" style={{ height }}>
      {title && <div className="text-xs text-[var(--text-3)] mb-1">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
        {/* Grid lines */}
        {yGrids.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)} stroke="#222" strokeWidth="0.3" />
            <text x={PAD.l - 1} y={toY(v)} textAnchor="end" fontSize="4" fill="#4b5563" dominantBaseline="middle">
              {Math.round(v)}{unit}
            </text>
          </g>
        ))}
        {/* Area fill */}
        {fill && <path d={fillPath} fill={color} fillOpacity="0.12" />}
        {/* Line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {showDots && data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(Number(d.y))} r="1.2" fill={color}
            onMouseEnter={() => setTooltip({ i, x: toX(i), y: toY(Number(d.y)), d })}
            onMouseLeave={() => setTooltip(null)} style={{ cursor: 'pointer' }} />
        ))}
        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect x={tooltip.x - 12} y={tooltip.y - 10} width="24" height="8" rx="1.5" fill="#1a1a1a" />
            <text x={tooltip.x} y={tooltip.y - 5.5} textAnchor="middle" fontSize="3.5" fill={color}>
              {Number(tooltip.d.y).toFixed(1)}{unit}
            </text>
          </g>
        )}
        {/* X labels */}
        {xLabels.map((d, idx) => {
          const origIdx = data.indexOf(d);
          return (
            <text key={idx} x={toX(origIdx)} y={H - 2} textAnchor="middle" fontSize="3.5" fill="#4b5563">
              {d.label || d.x}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
