'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center font-mono text-slate-800">
      <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <AlertCircle className="mx-auto mb-3 text-rose-600" size={22} />
        <p className="text-sm font-semibold">The dashboard could not load.</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Reload the dashboard to try again.</p>
        <button onClick={reset} className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3 text-xs font-medium text-white hover:bg-slate-700">
          <RefreshCw size={13} /> Reload
        </button>
      </div>
    </main>
  );
}
