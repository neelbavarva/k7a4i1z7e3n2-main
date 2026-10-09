import type { Metadata, Viewport } from 'next';
// headings are set in Fraunces, with its optical sizes: a little sharper as they get bigger
import '@fontsource-variable/fraunces/opsz.css';
// text and figures are set in IBM Plex Sans, as on the vault
import '@fontsource-variable/ibm-plex-sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kaizen Journal',
  description: 'A focused forex trade journal: trades, a monthly calendar and one-loss-a-day discipline.',
  robots: { index: false, follow: false },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='2' y='15' width='28' height='2' rx='1' fill='%23889'/%3E%3Ccircle cx='16' cy='16' r='6' fill='%232a78d6'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: '#f6f8f1',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

// Inside the Kaizen split view the page sits beside the other sites; globals.css then lines its
// top bar and title up with theirs (see "Split view" there).
const FRAMED = "if (window.self !== window.top) document.documentElement.classList.add('is-framed');";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: FRAMED may add a class to <html> before React hydrates it
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FRAMED }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
