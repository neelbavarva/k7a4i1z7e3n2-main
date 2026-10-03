// Banks, card types and payment networks.
//
// Only the last 4 digits of a card are stored readable, and they can't identify a network,
// so the network is detected from the full number when a card is added and kept, by name
// only, in the card's bankName together with the bank and the type:
//     "HDFC Bank · Credit · Visa"
// Older cards with just a bank name keep working: type and network are simply unknown
// until the card is revealed.

/** The banks offered when adding a card, with a colour close to each one's brand. */
export const BANKS = [
    { id: "hdfc", name: "HDFC Bank", short: "HDFC", color: "#004c8f" },
    { id: "sbi", name: "State Bank of India", short: "SBI", color: "#1d5fa8" },
    { id: "iob", name: "Indian Overseas Bank", short: "IOB", color: "#0d6a8f" },
    { id: "axis", name: "Axis Bank", short: "Axis", color: "#97144d" },
];

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
    return { bank, type, network, known: BANKS.find((b) => b.name.toLowerCase() === bank.toLowerCase() || b.short.toLowerCase() === bank.toLowerCase()) || null };
}
