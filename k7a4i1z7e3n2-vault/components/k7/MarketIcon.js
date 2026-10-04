// Round market icon, same as FX Fundamental Bias: two overlapping flags for forex
// (base in front), or the instrument's own coin with a small dollar flag behind it.
// Flags: country-flag-icons (MIT), see public/flags/LICENSE.txt.

const FLAGS = {
    USD: "US",
    EUR: "EU",
    GBP: "GB",
    AUD: "AU",
    NZD: "NZ",
    CAD: "CA",
    CHF: "CH",
    JPY: "JP",
};

const COINS = {
    XAU: { text: "Au", from: "#f8e08e", to: "#c7951e", ink: "#5a3d00" },
    XAG: { text: "Ag", from: "#f4f6f8", to: "#9aa4ad", ink: "#3b4249" },
    BTC: { text: "₿", from: "#ffd59a", to: "#e58a12", ink: "#5a3000" },
    ETH: { text: "Ξ", from: "#dfe4ff", to: "#7f8be0", ink: "#262f73" },
};

export function splitPair(symbol = "") {
    const [base = "", quote = ""] = String(symbol).toUpperCase().split("/");
    return { base, quote };
}

function Flag({ ccy }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/flags/${FLAGS[ccy]}.svg`} alt="" draggable="false" />;
}

function Coin({ id }) {
    const c = COINS[id];
    const g = `coin-${id}`;
    return (
        <svg viewBox="0 0 40 40" aria-hidden="true">
            <defs>
                <radialGradient id={g} cx="35%" cy="30%" r="75%">
                    <stop offset="0" stopColor={c.from} />
                    <stop offset="1" stopColor={c.to} />
                </radialGradient>
            </defs>
            <circle cx="20" cy="20" r="20" fill={`url(#${g})`} />
            <circle cx="20" cy="20" r="15.5" fill="none" stroke={c.ink} strokeOpacity="0.22" strokeWidth="1.2" />
            <text
                x="20"
                y="25.6"
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill={c.ink}
                fontFamily="Instrument Sans Variable, system-ui, sans-serif"
            >
                {c.text}
            </text>
        </svg>
    );
}

function Primary({ base, symbol }) {
    if (FLAGS[base]) return <Flag ccy={base} />;
    if (COINS[base]) return <Coin id={base} />;
    return <span className="mi-text">{(symbol || "?").slice(0, 2)}</span>;
}

export default function MarketIcon({ symbol, size = 22 }) {
    const { base, quote } = splitPair(symbol);
    return (
        <span className="mi" style={{ "--mi": `${size}px` }} aria-hidden="true">
            <span className="mi-a">
                <Primary base={base} symbol={symbol} />
            </span>
            {FLAGS[quote] && (
                <span className="mi-b">
                    <Flag ccy={quote} />
                </span>
            )}
        </span>
    );
}
