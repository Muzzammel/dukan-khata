'use client';
import { useEffect } from 'react';
import { flushOutbox } from '@/lib/offline';

/**
 * Registers the service worker (PWA / offline shell) and flushes any queued
 * offline writes once on load if we're back online. Renders nothing.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* ignore */});
    }
    if (navigator.onLine) {
      flushOutbox().catch(() => {});
    }
  }, []);
  return null;
}
