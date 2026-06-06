'use client';
import { useEffect } from 'react';
interface ToastProps { message: string; type: 'success'|'error'; onClose: () => void; }
export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast toast-${type}`} onClick={onClose}>{type==='success'?'✓ ':'⚠ '}{message}</div>;
}
