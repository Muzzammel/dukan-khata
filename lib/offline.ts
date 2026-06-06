// lib/offline.ts
// A small fetch wrapper that (a) surfaces API errors as thrown Errors so the UI
// can always show a toast, and (b) keeps a localStorage "outbox" so that
// create/update/delete requests made while offline are queued and replayed when
// the connection returns. Designed for shops with patchy signal.

export interface ApiError extends Error {
  status?: number;
  offline?: boolean;
}

const OUTBOX_KEY = 'dk-outbox';

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  ts: number;
  label: string; // human description for toasts
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * JSON fetch that throws on non-2xx with the server's error message attached.
 * Network failures throw an ApiError with `offline: true` so callers can queue.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (e) {
    const err: ApiError = new Error('You appear to be offline.');
    err.offline = true;
    throw err;
  }

  let json: unknown = null;
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const msg = (json as { error?: string })?.error || res.statusText || `Request failed (${res.status})`;
    const err: ApiError = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json as T;
}

// ── Outbox ────────────────────────────────────────────────
function readOutbox(): QueuedRequest[] {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); }
  catch { return []; }
}
function writeOutbox(items: QueuedRequest[]) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items)); } catch { /* quota */ }
}

export function queueRequest(req: Omit<QueuedRequest, 'id' | 'ts'>): QueuedRequest {
  const item: QueuedRequest = { ...req, id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6), ts: Date.now() };
  const all = readOutbox();
  all.push(item);
  writeOutbox(all);
  return item;
}

export function outboxCount(): number {
  return readOutbox().length;
}

/** Replay every queued request in order. Returns how many succeeded. */
export async function flushOutbox(): Promise<number> {
  let items = readOutbox();
  if (items.length === 0) return 0;
  let flushed = 0;

  for (const item of [...items]) {
    try {
      await apiFetch(item.url, { method: item.method, body: item.body ? JSON.stringify(item.body) : undefined });
      items = items.filter(i => i.id !== item.id);
      writeOutbox(items);
      flushed++;
    } catch (e) {
      // Stop on first failure (likely still offline); keep the rest queued.
      if ((e as ApiError).offline) break;
      // A real server rejection (e.g. duplicate invoice): drop it so it doesn't
      // block the queue forever.
      items = items.filter(i => i.id !== item.id);
      writeOutbox(items);
    }
  }
  return flushed;
}
