'use client';
import { useRef, useState, useCallback } from 'react';
import { resizeToBase64, formatBytes } from '@/lib/imageUtils';
import type { ExtractedData } from '@/types';

interface Props {
  shopId: string; shopName: string;
  /** Called with parsed rows for the user to review before saving. */
  onReview: (data: ExtractedData, date: string) => void;
  onError: (msg: string) => void;
}
type Status = 'idle'|'resizing'|'extracting'|'done'|'error';

/** Turn raw API/Gemini errors into short, human messages. */
function friendlyError(status: number, raw?: string): string {
  const text = String(raw ?? '');
  if (status === 429 || /quota|exceeded|rate.?limit|RESOURCE_EXHAUSTED/i.test(text)) {
    return "AI scan limit reached on the free Gemini tier. It resets after about a day — try again later, or add rows manually for now.";
  }
  if (status === 401 || status === 403) return 'AI scan is not authorized. Check the GEMINI_API_KEY in your hosting settings.';
  if (status === 404) return 'Shop not found. Pick a shop and try again.';
  if (status >= 500) return 'Could not read the photo. Try a clearer, well-lit image.';
  // Fallback: keep it short.
  return text.length > 140 ? text.slice(0, 140) + '…' : (text || 'Scan failed. Please try again.');
}

export function UploadZone({ shopId, shopName, onReview, onError }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [msg,    setMsg]    = useState('');
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { onError('Please select an image file'); return; }
    setStatus('resizing'); setMsg(formatBytes(file.size));

    let base64: string;
    try { base64 = await resizeToBase64(file); }
    catch (e: unknown) { setStatus('error'); onError(e instanceof Error ? e.message : 'Resize failed'); return; }

    setStatus('extracting'); setMsg('Reading handwriting…');
    try {
      const res  = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, image: base64, preview: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(friendlyError(res.status, json.details ?? json.error));
      const n = (json.extracted?.entries?.length ?? 0) + (json.extracted?.expenses?.length ?? 0);
      setStatus('done');
      setMsg(`Found ${n} row${n === 1 ? '' : 's'} — review & save`);
      onReview(json.extracted, json.date);
      setTimeout(() => { setStatus('idle'); setMsg(''); }, 3000);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Scan failed';
      setStatus('error'); setMsg(m); onError(m);
      setTimeout(() => { setStatus('idle'); setMsg(''); }, 6000);
    } finally {
      if (cameraRef.current)  cameraRef.current.value  = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  }, [shopId, onReview, onError]);

  const busy = status === 'resizing' || status === 'extracting';

  return (
    <div className="glass" style={{ padding: 24 }}>
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment"
        style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) process(f); }} />
      <input ref={galleryRef} type="file" accept="image/*"
        style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) process(f); }} />

      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-dim)' }}>
          Upload register photo for <span style={{ color:'var(--accent)', fontWeight:800 }}>{shopName}</span>
        </div>
      </div>

      {/* Status */}
      {(busy || status === 'done' || status === 'error') && (
        <div style={{
          textAlign:'center', padding:'12px 16px', borderRadius:12, marginBottom:16,
          background: status==='done' ? 'var(--green-dim)' : status==='error' ? 'var(--red-dim)' : 'rgba(124,111,205,0.1)',
          border: `1.5px solid ${status==='done' ? 'rgba(16,185,129,0.3)' : status==='error' ? 'rgba(239,68,68,0.3)' : 'rgba(124,111,205,0.25)'}`,
          color: status==='done' ? 'var(--green)' : status==='error' ? 'var(--red)' : 'var(--accent)',
          fontSize:13, fontWeight:700, lineHeight:1.45, maxHeight:160, overflowY:'auto', overflowWrap:'anywhere',
        }}>
          {busy && <><span className="spin">⟳</span>&nbsp;{status==='resizing' ? 'Preparing…' : 'Gemini reading handwriting…'}</>}
          {status==='done'  && <>✓ {msg}</>}
          {status==='error' && <>⚠ {msg}</>}
        </div>
      )}

      {/* Two buttons — circular (camera) + glass pill (gallery) like image 1 bottom-left */}
      <div style={{ display:'flex', alignItems:'center', gap:12, justifyContent:'center' }}>
        {/* Circular neumorphic camera button */}
        <button className="btn-circle" disabled={busy} onClick={() => cameraRef.current?.click()}
          style={{ width:64, height:64, opacity: busy ? 0.5 : 1, flexShrink:0 }}>
          <span style={{ fontSize:26 }}>📷</span>
        </button>

        {/* Glassy pill upload button */}
        <button className="btn btn-glass" disabled={busy} onClick={() => galleryRef.current?.click()}
          style={{ flex:1, padding:'15px 20px', fontSize:14, opacity: busy ? 0.5 : 1 }}>
          <span style={{ fontSize:18 }}>🖼️</span>
          From Gallery
        </button>
      </div>
    </div>
  );
}
