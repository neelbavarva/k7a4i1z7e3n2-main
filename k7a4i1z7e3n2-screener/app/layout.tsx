import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Kaizen - Screener', description: 'Macro market-flow research.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
