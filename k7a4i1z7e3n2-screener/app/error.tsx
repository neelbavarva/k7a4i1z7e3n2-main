'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <main className="page">
      <div className="state fade-in" role="alert">
        <p className="state-code">{offline ? 'Offline' : 'Something broke'}</p>
        <h1 className="state-title">{offline ? 'You’re offline' : 'The screener didn’t load'}</h1>
        <p className="state-text">
          {offline ? 'Reconnect to the internet and try again.' : 'This is usually a brief hiccup with a data provider. Try again in a moment.'}
        </p>
        <div className="state-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
