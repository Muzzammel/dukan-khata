// lib/format.ts
// Qatari Riyal (QR) money formatting helpers.
// Full form uses Western thousands grouping; compact form abbreviates
// large numbers as K / M / B for quick scanning (tap to reveal full value).

export const CURRENCY = 'QR';

/** Full value, e.g. -> "QR 1,234,567" */
export function money(n: number): string {
  const v = Math.round(Number(n) || 0);
  return `${CURRENCY} ${v.toLocaleString('en-US')}`;
}

/** Compact value, e.g. 1240 -> "QR 1.2K", 3_400_000 -> "QR 3.4M" */
export function moneyShort(n: number): string {
  const num = Number(n) || 0;
  const neg = num < 0;
  const abs = Math.abs(num);
  let out: string;

  if (abs < 1000) {
    out = String(Math.round(abs));
  } else if (abs < 1_000_000) {
    out = trim(abs / 1000) + 'K';
  } else if (abs < 1_000_000_000) {
    out = trim(abs / 1_000_000) + 'M';
  } else {
    out = trim(abs / 1_000_000_000) + 'B';
  }
  return `${neg ? '-' : ''}${CURRENCY} ${out}`;
}

/** Returns true when moneyShort actually abbreviates (>= 1000). */
export function isAbbreviated(n: number): boolean {
  return Math.abs(Number(n) || 0) >= 1000;
}

function trim(x: number): string {
  // one decimal, but drop a trailing ".0"
  const s = x.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
