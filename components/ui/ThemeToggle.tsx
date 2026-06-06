'use client';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
    setTheme(current);
  }, []);

  const toggle = () => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('dk-theme', next); } catch {}
      return next;
    });
  };

  return [theme, toggle];
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      aria-label="Toggle theme"
      style={{
        width: 40, height: 40, borderRadius: '50%', cursor: 'pointer',
        background: 'var(--glass-2)', border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'var(--glass-shadow)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 17, overflow: 'hidden', position: 'relative',
        transition: 'transform .25s var(--ease-spring)',
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <span
        key={theme}
        style={{ display: 'inline-block', animation: 'pop .45s var(--ease-spring)' }}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
