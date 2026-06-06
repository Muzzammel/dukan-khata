'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { money, moneyShort, isAbbreviated } from '@/lib/format';

interface Props {
  value: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  /** Abbreviate large values as K/M/B while animating (default true). */
  compact?: boolean;
  /** Custom formatter overrides currency formatting. */
  format?: (n: number) => string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Count-up animated QR amount. Re-animates from the previous value whenever
 * the target changes, pulses when it lands, and (for currency mode) lets the
 * user tap the final value to toggle between compact and full form.
 */
export function AnimatedNumber({ value, duration = 900, className, style, compact = true, format }: Props) {
  const [display, setDisplay] = useState(value);
  const [done, setDone] = useState(true);
  const [showFull, setShowFull] = useState(false);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) { setDisplay(to); setDone(true); return; }
    setDone(false);

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (to - from) * easeOut(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDone(true);
        if (elRef.current) {
          elRef.current.classList.remove('value-pulse');
          void elRef.current.offsetWidth;
          elRef.current.classList.add('value-pulse');
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  let text: string;
  if (format) {
    text = format(display);
  } else if (!done) {
    text = compact ? moneyShort(display) : money(display);
  } else {
    text = (!compact || showFull || !isAbbreviated(value)) ? money(value) : moneyShort(value);
  }

  const canToggle = done && !format && compact && isAbbreviated(value);

  return (
    <span
      ref={elRef}
      className={className}
      style={{ display: 'inline-block', cursor: canToggle ? 'pointer' : undefined, ...style }}
      title={format ? undefined : money(value)}
      aria-label={format ? undefined : money(value)}
      role={canToggle ? 'button' : undefined}
      tabIndex={canToggle ? 0 : undefined}
      onClick={canToggle ? (e) => { e.stopPropagation(); setShowFull(s => !s); } : undefined}
      onKeyDown={canToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowFull(s => !s); } } : undefined}
    >
      {text}
    </span>
  );
}
