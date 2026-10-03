// Small, simplified marks for card networks, drawn inline so nothing is fetched.
// Shown where a card's network is known (stored at add time, or from the revealed number).

const FONT = "Instrument Sans Variable, system-ui, sans-serif";

function Word({ text, color, italic, size = 13, weight = 800, spacing = 0 }) {
    return (
        <text
            x="50%"
            y="50%"
            dominantBaseline="central"
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={size}
            fontWeight={weight}
            fontStyle={italic ? "italic" : "normal"}
            letterSpacing={spacing}
            fill={color}
        >
            {text}
        </text>
    );
}

const MARKS = {
    visa: (
        <svg viewBox="0 0 46 20">
            <Word text="VISA" color="#1a1f71" italic size={14} spacing={0.5} />
        </svg>
    ),
    mastercard: (
        <svg viewBox="0 0 32 20">
            <circle cx="12" cy="10" r="8" fill="#eb001b" />
            <circle cx="20" cy="10" r="8" fill="#f79e1b" fillOpacity="0.92" />
            <path d="M16 3.07a8 8 0 0 1 0 13.86 8 8 0 0 1 0-13.86z" fill="#ff5f00" />
        </svg>
    ),
    maestro: (
        <svg viewBox="0 0 32 20">
            <circle cx="12" cy="10" r="8" fill="#0099df" />
            <circle cx="20" cy="10" r="8" fill="#e6001f" fillOpacity="0.92" />
            <path d="M16 3.07a8 8 0 0 1 0 13.86 8 8 0 0 1 0-13.86z" fill="#6c6bbd" />
        </svg>
    ),
    amex: (
        <svg viewBox="0 0 40 20">
            <rect width="40" height="20" rx="3" fill="#2e77bc" />
            <Word text="AMEX" color="#fff" size={10.5} spacing={0.6} />
        </svg>
    ),
    rupay: (
        <svg viewBox="0 0 54 20">
            <text x="0" y="50%" dominantBaseline="central" fontFamily={FONT} fontSize="13" fontWeight="800" fontStyle="italic" fill="#1b2d6b">
                RuPay
            </text>
            <path d="M44 4l6 6-6 6z" fill="#f47920" />
            <path d="M48 4l6 6-6 6z" fill="#109848" fillOpacity="0.9" />
        </svg>
    ),
    diners: (
        <svg viewBox="0 0 48 20">
            <circle cx="9" cy="10" r="8" fill="none" stroke="#0079be" strokeWidth="2" />
            <path d="M9 4v12" stroke="#0079be" strokeWidth="2" />
            <text x="21" y="50%" dominantBaseline="central" fontFamily={FONT} fontSize="9.5" fontWeight="700" fill="#0079be">
                Diners
            </text>
        </svg>
    ),
    discover: (
        <svg viewBox="0 0 60 20">
            <text x="0" y="50%" dominantBaseline="central" fontFamily={FONT} fontSize="10.5" fontWeight="800" fill="#231f20" letterSpacing="0.3">
                DISC
            </text>
            <circle cx="36" cy="10" r="5" fill="#f58220" />
            <text x="42" y="50%" dominantBaseline="central" fontFamily={FONT} fontSize="10.5" fontWeight="800" fill="#231f20" letterSpacing="0.3">
                VER
            </text>
        </svg>
    ),
    jcb: (
        <svg viewBox="0 0 36 20">
            <rect x="0" y="1" width="11" height="18" rx="3" fill="#0b4ea2" />
            <rect x="12.5" y="1" width="11" height="18" rx="3" fill="#e21836" />
            <rect x="25" y="1" width="11" height="18" rx="3" fill="#007b40" />
            <text x="5.5" y="50%" dominantBaseline="central" textAnchor="middle" fontFamily={FONT} fontSize="9" fontWeight="800" fill="#fff">J</text>
            <text x="18" y="50%" dominantBaseline="central" textAnchor="middle" fontFamily={FONT} fontSize="9" fontWeight="800" fill="#fff">C</text>
            <text x="30.5" y="50%" dominantBaseline="central" textAnchor="middle" fontFamily={FONT} fontSize="9" fontWeight="800" fill="#fff">B</text>
        </svg>
    ),
    unionpay: (
        <svg viewBox="0 0 40 20">
            <path d="M4 1h10l-4 18H0z" fill="#e21836" />
            <path d="M14 1h10l-4 18H10z" fill="#00447c" />
            <path d="M24 1h12l-4 18H20z" fill="#007b84" />
            <Word text="UP" color="#fff" size={9} />
        </svg>
    ),
};

/** The mark for a network ({ id, name }), with the name for screen readers. */
export default function NetworkMark({ network, className = "" }) {
    if (!network || !MARKS[network.id]) return null;
    return (
        <span className={`net-mark net-${network.id} ${className}`} role="img" aria-label={network.name} title={network.name}>
            {MARKS[network.id]}
        </span>
    );
}
