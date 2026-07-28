export default function Loading() {
  const skeletonBadge = (w: string) => (
    <span className="skeleton inline-block h-6 rounded-md" style={{ width: w }} />
  );

  return (
    <main className="light-ui min-h-screen bg-[#f8fafc]" aria-label="Loading Kaizen Screener">
      {/* Header skeleton */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95">
        <div className="mx-auto flex h-12 sm:h-14 max-w-[1120px] items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-2">
            <span className="skeleton h-5 w-20 rounded" />
            <span className="skeleton h-4 w-14 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <span className="skeleton h-8 w-24 rounded-md" />
            <span className="skeleton h-8 w-20 rounded-md" />
          </div>
        </div>
      </header>

      <div className="grain">
        <div className="mx-auto max-w-[1120px] px-3 pb-6 space-y-3 pt-3">
          {/* Market pill strip */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5">
            {skeletonBadge('72px')}
            {skeletonBadge('80px')}
          </div>

          {/* Market snapshot table */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="skeleton h-3 w-28 rounded" />
              <span className="skeleton h-3 w-24 rounded" />
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-4 px-3 py-3">
                  <span className="skeleton h-4 w-24 rounded" />
                  <span className="skeleton h-4 w-20 rounded" />
                  <span className="skeleton h-4 w-20 rounded" />
                  <span className="skeleton h-4 w-16 rounded" />
                  <span className="skeleton h-4 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Chart panel */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <div className="space-y-1.5">
                <span className="skeleton h-4 w-40 rounded block" />
                <span className="skeleton h-3 w-56 rounded block" />
              </div>
              <div className="flex items-center gap-1.5">
                {['GDP','Mkt Cap','Buffett','Relative','Growth','AI flow','Bubbles','Valuation'].map(label => (
                  <span key={label} className="skeleton h-7 w-14 rounded" />
                ))}
              </div>
            </div>
            <div className="skeleton mx-1 my-1 rounded" style={{ height: 'var(--chart-h, 360px)' }} />
          </div>

          {/* Info banner */}
          <div className="skeleton h-12 w-full rounded-lg" />

          {/* Data sources */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-3 py-2">
              <span className="skeleton h-3 w-24 rounded block" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="border-b border-slate-100 last:border-0 px-3 py-3">
                <span className="skeleton h-3 w-32 rounded block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
