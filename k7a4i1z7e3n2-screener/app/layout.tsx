import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Kaizen Screener',
    template: '%s · Kaizen Screener',
  },
  description: 'Macro market-flow research terminal. Compare GDP, market capitalisation, Buffett indicator, AI capital flows, and historical bubble benchmarks across markets.',
  keywords: ['macro research', 'GDP', 'market cap', 'Buffett indicator', 'AI capital flow', 'economic screener'],
  authors: [{ name: 'Kaizen' }],
  creator: 'Kaizen',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: 'Kaizen Screener',
    description: 'Macro market-flow research terminal — GDP, valuations, AI capital flows and historical bubble benchmarks.',
    siteName: 'Kaizen Screener',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kaizen Screener',
    description: 'Macro market-flow research terminal — GDP, valuations, AI capital flows and historical bubble benchmarks.',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
