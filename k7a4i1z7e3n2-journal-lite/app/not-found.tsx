import Link from 'next/link';
import { Mark } from '@/components/JournalApp';

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
          <h1 className="state-title">Nothing here</h1>
          <p className="state-text">The journal lives on the home page.</p>
          <div className="state-actions">
            <Link className="btn btn-primary" href="/">
              Open the journal
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
