'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Tiny animated sparkline. Draws a smooth area + line that "grows" in on
 * mount and whenever the data changes. Falls back to a flat baseline when
 * there is little or no data.
 */
export function Sparkline({ data, color = 'var(--accent)', width = 120, height = 46 }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const [id] = useState(() => 'sl' + Math.random().toString(36).slice(2, 8));

  const series = data.length >= 2 ? data : [data[0] ?? 0, data[0] ?? 0];
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const pad = 3;
  const w = width, h = height;

  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  const last = pts[pts.length - 1];

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    p.style.transition = 'none';
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    void p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.32,.72,0,1)';
    p.style.strokeDashoffset = '0';
  }, [line]);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} stroke="none" />
      <path ref={pathRef} d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}
