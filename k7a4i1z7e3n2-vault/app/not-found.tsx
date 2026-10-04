import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="page">
            <main className="state fade-in">
                <p className="state-code">404</p>
                <h1 className="state-title">This page doesn’t exist</h1>
                <p className="state-text">The link may be broken, or the page may have moved.</p>
                <div className="state-actions">
                    <Link className="btn btn-primary" href="/">
                        Back to the vault
                    </Link>
                </div>
                <Image className="state-img" src="/icons/meme.jpg" alt="" width={400} height={300} loading="eager" />
            </main>
        </div>
    );
}
