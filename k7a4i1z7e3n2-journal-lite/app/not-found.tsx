import Link from 'next/link';
import { Mark } from '@/components/JournalApp';

/** Where a 404 points: the journal, or the sample one to try. */
const PAGES: [string, string, string][] = [
  ['/', 'Your journal', 'Trades, the monthly calendar and one-loss-a-day discipline.'],
  ['/?demo', 'Try the sample journal', 'Four months of made-up trades. Nothing is saved or sent.'],
];

export default function NotFound() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link className="brand" href="/">
            <Mark />
            <span className="brand-name">Kaizen Journal</span>
          </Link>
        </div>
      </header>
      <main className="page">
        <div className="state">
          <p className="state-code">404</p>
          <h1 className="state-title">This page doesn’t exist</h1>
          <p className="state-text">The link may be broken, or the page may have moved.</p>
          <nav className="nf-links" aria-label="Pages on this site">
            <p className="nf-title">Try one of these</p>
            {PAGES.map(([href, title, text]) => (
              <Link key={href} href={href}>
                <span>
                  <b>{title}</b>
                  <small>{text}</small>
                </span>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </>
  );
}
