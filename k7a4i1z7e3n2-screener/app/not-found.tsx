export default function NotFound() {
  return (
    <main className="page">
      <div className="state fade-in">
        <p className="state-code">404</p>
        <h1 className="state-title">This page doesn’t exist</h1>
        <p className="state-text">The link may be broken, or the page may have moved. The screener itself lives on the home page.</p>
        <div className="state-actions">
          <a className="btn btn-primary" href="/">
            Open the screener
          </a>
        </div>
      </div>
    </main>
  );
}
