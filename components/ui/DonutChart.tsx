'use client';
import { money } from '@/lib/format';
interface Slice { label: string; value: number; color: string; }

export function DonutChart({ slices, size = 160 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((s,x) => s + x.value, 0);
  if (total === 0) return (
    <div className="glass" style={{ width:size, height:size, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--text-muted)' }}>
      No data
    </div>
  );

  const r = 42; const c = 50; const circ = 2 * Math.PI * r;
  let cum = 0;
  const paths = slices.filter(s => s.value > 0).map(s => {
    const pct = s.value / total;
    const off = circ * (1 - cum);
    const dash = circ * pct;
    cum += pct;
    return { ...s, dash, off };
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
      <div style={{ position:'relative', display:'inline-block', filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          {paths.map((p,i) => (
            <circle key={i} cx={c} cy={c} r={r} fill="none"
              stroke={p.color} strokeWidth="16"
              strokeDasharray={`${p.dash} ${circ - p.dash}`}
              strokeDashoffset={-p.off + circ}
            />
          ))}
          <circle cx={c} cy={c} r="27" fill="var(--bg-soft)" />
        </svg>
        {/* Center total */}
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:9, fontWeight:800, letterSpacing:.8, color:'var(--text-muted)', textTransform:'uppercase' }}>Total</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color:'var(--text)' }}>
            {money(total)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:8 }}>
        {paths.map((p,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:4, background:p.color, boxShadow:`0 2px 6px ${p.color}55` }} />
              <span style={{ fontSize:12, color:'var(--text-dim)', fontWeight:600 }}>{p.label}</span>
            </div>
            <div style={{ textAlign:'right' }}>
              <span style={{ fontSize:13, fontFamily:'var(--mono)', fontWeight:700, color:'var(--text)' }}>
                {money(p.value)}
              </span>
              <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:4 }}>
                {Math.round((p.value/total)*100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
