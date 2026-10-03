import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource/young-serif/400.css";
import "./globals.css";

export const metadata: Metadata = {
    title: "k7a4i1z7e3n2",
    description: "A private vault for passwords and cards, and a journal for trades.",
};

export const viewport: Viewport = {
    themeColor: "#f6f8f1",
    colorScheme: "light",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
