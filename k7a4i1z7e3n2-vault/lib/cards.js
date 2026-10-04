// Banks, card types and payment networks.
//
// Only the last 4 digits of a card are stored readable, and they can't identify a network,
// so the network is detected from the full number when a card is added and kept, by name
// only, in the card's bankName together with the bank and the type:
//     "HDFC Bank · Credit · Visa"
// Older cards with just a bank name keep working: type and network are simply unknown
// until the card is revealed.

/** How the bank list is grouped when browsing it. */
export const BANK_GROUPS = [
    { id: "private", label: "Private banks" },
    { id: "public", label: "Public sector banks" },
    { id: "small", label: "Small finance banks" },
    { id: "foreign", label: "Foreign banks" },
    { id: "payments", label: "Payments banks" },
];

/**
 * Banks that issue cards in India. `top` ones are shown as tiles, the rest are searchable.
 * `color` is the card's face: the brand colour of the bank's logo, taken darker and a little
 * quieter so white reads on it and it sits with the site's inks.
 * `logo` is [width / height of the full logo, has a separate symbol]; width 0 means the source
 * is only a symbol, so the name is set beside it. The logos themselves are in public/logos.
 */
export const BANKS = [
    { id: "hdfc", name: "HDFC Bank", short: "HDFC", color: "#074b8a", group: "private", top: true, logo: [6.0, true] },
    { id: "sbi", name: "State Bank of India", short: "SBI", color: "#292075", group: "public", top: true, aliases: ["state bank"], logo: [2.92, true] },
    { id: "iob", name: "Indian Overseas Bank", short: "IOB", color: "#1e469d", group: "public", top: true, logo: [5.65, true] },
    { id: "axis", name: "Axis Bank", short: "Axis", color: "#891846", group: "private", top: true, logo: [4.21, true] },

    { id: "icici", name: "ICICI Bank", short: "ICICI", color: "#a12f31", group: "private", logo: [5.04, true] },
    { id: "kotak", name: "Kotak Mahindra Bank", short: "Kotak", color: "#a1302b", group: "private", logo: [4.03, true] },
    { id: "indusind", name: "IndusInd Bank", short: "IndusInd", color: "#98272a", group: "private", logo: [9.58, false] },
    { id: "yes", name: "Yes Bank", short: "Yes", color: "#034e8c", group: "private", logo: [2.78, false] },
    { id: "idfc", name: "IDFC FIRST Bank", short: "IDFC FIRST", color: "#98262b", group: "private", logo: [2.83, true] },
    { id: "federal", name: "Federal Bank", short: "Federal", color: "#14479d", group: "private", logo: [6.03, false] },
    { id: "rbl", name: "RBL Bank", short: "RBL", color: "#214099", group: "private", aliases: ["ratnakar"], logo: [3.38, true] },
    { id: "bandhan", name: "Bandhan Bank", short: "Bandhan", color: "#a13029", group: "private", logo: [5.08, true] },
    { id: "idbi", name: "IDBI Bank", short: "IDBI", color: "#045b4a", group: "private", logo: [4.78, true] },
    { id: "sib", name: "South Indian Bank", short: "SIB", color: "#9b2b21", group: "private", logo: [2.82, true] },
    { id: "kvb", name: "Karur Vysya Bank", short: "KVB", color: "#0b5c33", group: "private", logo: [3.57, true] },
    { id: "cub", name: "City Union Bank", short: "CUB", color: "#2e328f", group: "private", logo: [1.08, true] },
    { id: "karnataka", name: "Karnataka Bank", short: "Karnataka", color: "#70287d", group: "private", logo: [7.69, true] },
    { id: "tmb", name: "Tamilnad Mercantile Bank", short: "TMB", color: "#2c3f8f", group: "private" },
    { id: "dcb", name: "DCB Bank", short: "DCB", color: "#26358f", group: "private", logo: [4.16, false] },
    { id: "jk", name: "J&K Bank", short: "J&K", color: "#03527c", group: "private", aliases: ["jammu", "kashmir"], logo: [3.29, true] },
    { id: "csb", name: "CSB Bank", short: "CSB", color: "#03428e", group: "private", aliases: ["catholic syrian"] },
    { id: "dhanlaxmi", name: "Dhanlaxmi Bank", short: "Dhanlaxmi", color: "#540443", group: "private", logo: [5.12, true] },

    { id: "pnb", name: "Punjab National Bank", short: "PNB", color: "#8c1735", group: "public", logo: [2.46, true] },
    { id: "bob", name: "Bank of Baroda", short: "BoB", color: "#9b3b08", group: "public", aliases: ["baroda"], logo: [3.08, true] },
    { id: "canara", name: "Canara Bank", short: "Canara", color: "#08527c", group: "public", logo: [3.74, true] },
    { id: "union", name: "Union Bank of India", short: "Union", color: "#a13126", group: "public", logo: [4.75, true] },
    { id: "boi", name: "Bank of India", short: "BOI", color: "#964008", group: "public" },
    { id: "indian", name: "Indian Bank", short: "Indian", color: "#1c4c8c", group: "public" },
    { id: "central", name: "Central Bank of India", short: "Central", color: "#a1302d", group: "public" },
    { id: "uco", name: "UCO Bank", short: "UCO", color: "#064d8f", group: "public" },
    { id: "bom", name: "Bank of Maharashtra", short: "Mahabank", color: "#03527e", group: "public", aliases: ["maharashtra"] },
    { id: "psb", name: "Punjab & Sind Bank", short: "P&SB", color: "#015d2c", group: "public", aliases: ["punjab and sind"] },

    { id: "au", name: "AU Small Finance Bank", short: "AU", color: "#6c2276", group: "small" },
    { id: "equitas", name: "Equitas Small Finance Bank", short: "Equitas", color: "#934404", group: "small" },
    { id: "ujjivan", name: "Ujjivan Small Finance Bank", short: "Ujjivan", color: "#085a4f", group: "small" },
    { id: "jana", name: "Jana Small Finance Bank", short: "Jana", color: "#065d31", group: "small" },
    { id: "suryoday", name: "Suryoday Small Finance Bank", short: "Suryoday", color: "#9d3808", group: "small" },
    { id: "slice", name: "slice Small Finance Bank", short: "slice", color: "#553494", group: "small" },

    { id: "amex", name: "American Express", short: "Amex", color: "#014f8b", group: "foreign", logo: [1.0, true] },
    { id: "sc", name: "Standard Chartered", short: "StanChart", color: "#034a9a", group: "foreign", aliases: ["stanchart", "scb"], logo: [2.55, true] },
    { id: "hsbc", name: "HSBC", short: "HSBC", color: "#a13029", group: "foreign", logo: [3.71, true] },
    { id: "citi", name: "Citibank", short: "Citi", color: "#053b6e", group: "foreign", aliases: ["citi"], logo: [1.55, true] },
    { id: "dbs", name: "DBS Bank", short: "DBS", color: "#a1302b", group: "foreign", logo: [3.47, true] },
    { id: "deutsche", name: "Deutsche Bank", short: "Deutsche", color: "#0f2f86", group: "foreign", logo: [0, true] },
    { id: "barclays", name: "Barclays", short: "Barclays", color: "#06395b", group: "foreign", logo: [0, true] },

    { id: "airtel", name: "Airtel Payments Bank", short: "Airtel", color: "#a13126", group: "payments", logo: [6.54, true] },
    { id: "ippb", name: "India Post Payments Bank", short: "IPPB", color: "#a12f34", group: "payments", aliases: ["post office"] },
    { id: "jio", name: "Jio Payments Bank", short: "Jio", color: "#0c2a81", group: "payments", logo: [1.0, true] },
    { id: "fino", name: "Fino Payments Bank", short: "Fino", color: "#612f8c", group: "payments" },
];

/** Tile colours for banks that aren't in the list, in the same depth as the listed ones. */
const CUSTOM_COLORS = ["#1c4c8c", "#8c2a3a", "#145c47", "#553494", "#934404", "#085a5f", "#3a4656", "#70287d"];

const hashOf = (s = "") => {
    let h = 0;
    for (const ch of String(s).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
};

/** A bank not in the list always gets the same colour. */
export function bankColor(name = "") {
    return CUSTOM_COLORS[hashOf(name) % CUSTOM_COLORS.length];
}

/**
 * Card faces: quiet colour pairs, lighter at the top left. Picked per bank but not from its
 * brand, so neighbouring banks in the list (and the four most used) all differ.
 */
export const CARD_FACES = [
    ["#5d646b", "#373b40"], // slate
    ["#4f5e8a", "#2e3858"], // navy
    ["#3f7074", "#274548"], // teal
    ["#8a5470", "#593349"], // wine
    ["#7b5f99", "#52446b"], // plum
    ["#6f6c4e", "#45432f"], // olive
    ["#8b5d47", "#5a3b2c"], // sienna
    ["#4f705a", "#32483a"], // forest
];
/** The face for a card whose bank isn't chosen yet. */
export const BLANK_FACE = ["#4b5056", "#2d3136"];

/** Which of CARD_FACES a bank's cards use (a BANKS entry, or a name typed in); -1 for none yet. */
export function faceIndex(known, name) {
    if (known) return BANKS.indexOf(known) % CARD_FACES.length;
    return name ? hashOf(name) % CARD_FACES.length : -1;
}

/** The face colours for a bank, or the blank face before one is picked. */
export function cardFace(known, name) {
    const i = faceIndex(known, name);
    return i < 0 ? BLANK_FACE : CARD_FACES[i];
}

/** Faces for a row of cards (by _id): each bank's own, moved on one where it would repeat its neighbour's. */
export function rowFaces(cards) {
    const faces = new Map();
    let prev = -1;
    for (const c of cards) {
        const { known, bank } = parseBankName(c.bankName);
        let i = faceIndex(known, bank);
        if (i < 0) i = 0;
        if (i === prev) i = (i + 1) % CARD_FACES.length;
        faces.set(c._id, CARD_FACES[i]);
        prev = i;
    }
    return faces;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();

/** The listed bank a name refers to, by its full name, short name or an alias. */
export function findBank(name) {
    const n = norm(name);
    if (!n) return null;
    return BANKS.find((b) => norm(b.name) === n || norm(b.short) === n || (b.aliases || []).some((a) => norm(a) === n)) || null;
}

/** Banks matching a search, best first: a short-name or word-start match beats one in the middle. */
export function searchBanks(query) {
    const q = norm(query);
    if (!q) return [];
    const score = (b) => {
        const names = [b.short, b.name, ...(b.aliases || [])].map(norm);
        if (names.some((n) => n === q)) return 0;
        if (names.some((n) => n.startsWith(q))) return 1;
        if (names.some((n) => n.split(" ").some((w) => w.startsWith(q)))) return 2;
        if (names.some((n) => n.includes(q))) return 3;
        return -1;
    };
    return BANKS.map((b) => [b, score(b)])
        .filter(([, s]) => s >= 0)
        .sort((a, b) => a[1] - b[1])
        .map(([b]) => b);
}

export const CARD_TYPES = ["Credit", "Debit", "Prepaid"];

/**
 * Payment networks by issuer identification number (the first digits), the same public
 * ranges payment gateways use. Each range is [from, to] on a prefix of that length; the
 * longest matching prefix wins, so RuPay's 652150–653149 beats Discover's 65.
 */
export const NETWORKS = [
    { id: "visa", name: "Visa", lengths: [13, 16, 19], ranges: [["4", "4"]] },
    { id: "mastercard", name: "Mastercard", lengths: [16], ranges: [["51", "55"], ["2221", "2720"]] },
    { id: "amex", name: "American Express", lengths: [15], ranges: [["34", "34"], ["37", "37"]] },
    { id: "diners", name: "Diners Club", lengths: [14, 16, 19], ranges: [["300", "305"], ["309", "309"], ["36", "36"], ["38", "39"]] },
    {
        id: "rupay",
        name: "RuPay",
        lengths: [16],
        ranges: [["508500", "508999"], ["606985", "607984"], ["608001", "608500"], ["652150", "653149"]],
    },
    { id: "discover", name: "Discover", lengths: [16, 19], ranges: [["6011", "6011"], ["644", "649"], ["65", "65"]] },
    { id: "jcb", name: "JCB", lengths: [16, 19], ranges: [["3528", "3589"]] },
    { id: "unionpay", name: "UnionPay", lengths: [16, 17, 18, 19], ranges: [["62", "62"]] },
    {
        id: "maestro",
        name: "Maestro",
        lengths: [12, 13, 14, 15, 16, 17, 18, 19],
        ranges: [["5018", "5018"], ["5020", "5020"], ["5038", "5038"], ["5893", "5893"], ["6304", "6304"], ["6759", "6759"], ["6761", "6763"]],
    },
    { id: "mir", name: "Mir", lengths: [16, 17, 18, 19], ranges: [["2200", "2204"]] },
    {
        id: "verve",
        name: "Verve",
        lengths: [16, 18, 19],
        ranges: [["506099", "506198"], ["507865", "507964"], ["650002", "650027"]],
    },
    { id: "troy", name: "Troy", lengths: [16], ranges: [["9792", "9792"]] },
    { id: "uatp", name: "UATP", lengths: [15], ranges: [["1", "1"]] },
];

const digitsOf = (s) => String(s || "").replace(/\D/g, "");

/** The network for a (possibly partly typed) card number, or null. */
export function detectNetwork(number) {
    const d = digitsOf(number);
    let best = null;
    let bestLen = 0;
    for (const net of NETWORKS) {
        for (const [from, to] of net.ranges) {
            const len = from.length;
            if (d.length < len || len <= bestLen) continue;
            const p = d.slice(0, len);
            if (p >= from && p <= to) {
                best = net;
                bestLen = len;
            }
        }
    }
    return best;
}

/** Luhn checksum, the check digit every card number carries. */
export function luhnValid(number) {
    const d = digitsOf(number);
    if (d.length < 12) return false;
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
        let n = Number(d[d.length - 1 - i]);
        if (i % 2) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
    }
    return sum % 10 === 0;
}

/** How a number is grouped for display: Amex is 4-6-5, everything else in fours. */
export function groupNumber(number, network) {
    const d = digitsOf(number);
    if (network?.id === "amex") return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
    return d.replace(/(.{4})(?=.)/g, "$1 ");
}

const SEP = " · ";

/** "HDFC Bank", "Credit", "Visa" → "HDFC Bank · Credit · Visa" (missing parts left out). */
export function composeBankName({ bank, type, network }) {
    return [bank, type, network].filter(Boolean).join(SEP);
}

/** The stored bankName back into its parts; anything unrecognised stays part of the bank. */
export function parseBankName(value = "") {
    const parts = String(value).split(SEP).map((s) => s.trim()).filter(Boolean);
    let type = null;
    let network = null;
    while (parts.length > 1) {
        const last = parts[parts.length - 1];
        const net = NETWORKS.find((n) => n.name.toLowerCase() === last.toLowerCase());
        const typ = CARD_TYPES.find((t) => t.toLowerCase() === last.toLowerCase());
        if (net && !network) network = net;
        else if (typ && !type) type = typ;
        else break;
        parts.pop();
    }
    const bank = parts.join(SEP);
    return { bank, type, network, known: findBank(bank) };
}
