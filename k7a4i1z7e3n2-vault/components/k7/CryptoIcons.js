"use client";

import { NETWORKS, TOKENS } from "@/lib/icons";
import { NATIVE } from "@/lib/wallets";
import { Mark } from "./Marks";

// Icons for crypto: the wallet apps, coins, and the networks coins live on. The SVGs come from
// lib/icons.js (static, trusted markup).

function Svg({ svg, size, className = "" }) {
    return <span className={`ci ${className}`} style={{ "--cs": `${size}px` }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/**
 * A wallet app's mark: its colour with its logo in white, like every account on the net worth
 * page. An installed extension's own icon wins when there is one.
 */
export function WalletIcon({ id, icon, size = 40 }) {
    if (!icon) return <Mark mark={{ wallet: id }} size={size} />;
    return (
        <span className="wi" style={{ "--ws": `${size}px` }} aria-hidden="true">
            {/* the extension's own icon, a data URL it hands over: nothing for next/image to optimise */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} alt="" />
        </span>
    );
}

export function NetworkIcon({ network, size = 16 }) {
    const svg = NETWORKS[network];
    return svg ? <Svg svg={svg} size={size} className="ci-net" /> : null;
}

/**
 * A coin's icon, with its network as a small badge when the coin isn't that network's own
 * (USDT on Tron, ETH on Arbitrum).
 */
export function CoinIcon({ token, network, size = 32 }) {
    const svg = TOKENS[token];
    const badge = network && NATIVE[network] !== token;
    return (
        <span className="coin" style={{ "--cs": `${size}px` }} aria-hidden="true">
            {svg ? <Svg svg={svg} size={size} /> : <span className="coin-letter">{String(token || "?").slice(0, 1)}</span>}
            {badge && (
                <span className="coin-badge">
                    <NetworkIcon network={network} size={Math.round(size * 0.46)} />
                </span>
            )}
        </span>
    );
}

/** A row of network icons, overlapping a little, for "one address covers all of these". */
export function NetworkStack({ networks, size = 18 }) {
    return (
        <span className="ci-stack" aria-hidden="true">
            {networks.map((n) => (
                <NetworkIcon key={n} network={n} size={size} />
            ))}
        </span>
    );
}
