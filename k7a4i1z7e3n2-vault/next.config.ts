import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "s3.tradingview.com",
                pathname: "/snapshots/**",
            },
        ],
        // Alternatively, a simpler option:
        // domains: ["s3.tradingview.com"],
    },
};

export default nextConfig;
