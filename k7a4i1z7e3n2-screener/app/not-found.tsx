import Link from 'next/link';

/** Where a 404 points: the screener and how it works. */
const PAGES: [string, string, string][] = [
  ['/', 'The screener', 'GDP, market value, the Buffett indicator and AI capital flows, market by market.'],
  ['/how-it-works', 'How the screener works', 'Where every number comes from, and every formula and threshold.'],
];

export default function NotFound() {
  return (
    <main className="page">
      <div className="state fade-in">
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
  );
}
