import type { Metadata, Viewport } from 'next';
// headings are set in Fraunces, with its optical sizes: a little sharper as they get bigger
import '@fontsource-variable/fraunces/opsz.css';
// text and figures are set in IBM Plex Sans, as on the vault
import '@fontsource-variable/ibm-plex-sans';
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
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='15' width='28' height='2' rx='1' fill='%23889'/%3E%3Crect x='7' y='9' width='5' height='14' rx='2.5' fill='%232a78d6'/%3E%3Crect x='20' y='5' width='5' height='22' rx='2.5' fill='%23161a16'/%3E%3C/svg%3E",
  },
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
  themeColor: '#f6f8f1',
  width: 'device-width',
  initialScale: 1,
};

// Inside the Kaizen split view the page sits beside the other sites; globals.css then lines its
// margins up with theirs (see "Split view" there).
const FRAMED = "if (window.self !== window.top) document.documentElement.classList.add('is-framed');";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: FRAMED may add a class to <html> before React hydrates it
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FRAMED }} />
      </head>
      <body>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
