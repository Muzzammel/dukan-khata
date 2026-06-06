import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from '@/components/ui/RegisterSW';

export const metadata: Metadata = {
  title: 'Dukan Khata',
  description: 'Smart ledger for your shops — photo to entries, in glassy style',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Dukan Khata' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#07070c' },
    { media: '(prefers-color-scheme: light)', color: '#eef0f8' },
  ],
};

// Runs before paint to set the theme and avoid a flash of the wrong colors.
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('dk-theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="aurora" aria-hidden="true"><span /><span /><span /></div>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
