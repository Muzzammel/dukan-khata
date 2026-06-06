'use client';
import { useState, type CSSProperties } from 'react';
import { money, moneyShort, isAbbreviated } from '@/lib/format';

interface Props {
  value: number;
  className?: string;
  style?: CSSProperties;
  /** Start in compact form (default true). Tap toggles to full value. */
  compact?: boolean;
}

/**
 * Displays a QR amount. Large values are abbreviated (QR 1.2K) and expand to
 * the full value (QR 1,234) when tapped/clicked. Accessible: the title and
 * aria-label always carry the full value.
 */
export function Money({ value, className, style, compact = true }: Props) {
  const [showFull, setShowFull] = useState(false);
  const full = money(value);
  const canToggle = compact && isAbbreviated(value);
  const text = !compact || showFull || !isAbbreviated(value) ? full : moneyShort(value);

  return (
    <span
      className={className}
      style={{ ...style, cursor: canToggle ? 'pointer' : style?.cursor }}
      title={full}
      aria-label={full}
      role={canToggle ? 'button' : undefined}
      tabIndex={canToggle ? 0 : undefined}
      onClick={canToggle ? (e) => { e.stopPropagation(); setShowFull(s => !s); } : undefined}
      onKeyDown={canToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowFull(s => !s); } } : undefined}
    >
      {text}
    </span>
  );
}
