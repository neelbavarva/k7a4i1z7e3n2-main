import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource/young-serif/400.css";
// money is set in Literata: Young Serif's kin, with a real ₹ and even, tabular figures
import "@fontsource-variable/literata/opsz.css";
// bank cards set their own type, like printed cards: see .bank-card in globals.css
import "@fontsource-variable/montserrat";
import "@fontsource/share-tech-mono/400.css";
import "./globals.css";

export const metadata: Metadata = {
    title: "k7a4i1z7e3n2",
    description: "A private vault for passwords and cards, and a journal for trades.",
};

export const viewport: Viewport = {
    themeColor: "#f6f8f1",
    colorScheme: "light",
};

// Inside the Kaizen split view the page sits beside the other sites; globals.css then lines its
// top bar and title up with theirs (see "Split view" there).
const FRAMED = "if (window.self !== window.top) document.documentElement.classList.add('is-framed');";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        // suppressHydrationWarning: FRAMED may add a class to <html> before React hydrates it
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: FRAMED }} />
            </head>
            <body>{children}</body>
        </html>
    );
}
