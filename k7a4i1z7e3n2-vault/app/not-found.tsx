import Link from "next/link";

export default function NotFound() {
    return (
        <div className="page">
            <main className="state fade-in">
                <p className="state-code">404</p>
                <h1 className="state-title">This page doesn’t exist</h1>
                <p className="state-text">The link may be broken, or the page may have moved.</p>
                <nav className="nf-links" aria-label="Pages on this site">
                    <p className="nf-title">Go to</p>
                    <Link href="/">
                        <span>
                            <b>The vault</b>
                            <small>Passwords, cards and your trade journal, behind the lock.</small>
                        </span>
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M6 3.5 10.5 8 6 12.5" />
                        </svg>
                    </Link>
                </nav>
            </main>
        </div>
    );
}
