/** Placeholder shaped like the page that's loading, so nothing jumps when it arrives. */
export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading Kaizen Screener">
      <div className="skeleton">
        <div className="sk sk-bar" />
        <div className="sk-row">
          <div className="sk sk-btn" />
          <div className="sk sk-btn" />
        </div>
        <div className="sk sk-title" />
        <div className="sk sk-line" />
        <div className="sk-brief">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="sk sk-cell" />
          ))}
        </div>
        <div className="sk sk-card" />
        <div className="sk sk-rows" />
      </div>
    </main>
  );
}
