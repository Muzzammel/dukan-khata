'use client';
import type { CSSProperties } from 'react';

export function Skeleton({ height = 16, width = '100%', radius = 8, style }: { height?: number | string; width?: number | string; radius?: number; style?: CSSProperties; }) {
  return (
    <div
      className="shimmer"
      aria-hidden="true"
      style={{
        height, width, borderRadius: radius,
        background: 'var(--glass)',
        border: '1px solid var(--glass-border)',
        ...style,
      }}
    />
  );
}

/** A card-shaped skeleton matching the ledger/expense row layout. */
export function SkeletonCard() {
  return (
    <div className="glass glass-pad" style={{ marginBottom: 11, padding: 16 }} aria-hidden="true">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <Skeleton width={90} height={20} radius={20} />
        <Skeleton width={54} height={20} radius={10} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Skeleton height={32} />
        <Skeleton height={32} />
        <Skeleton height={32} />
      </div>
    </div>
  );
}

/** Several skeleton cards. */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
