// Money as it's typed: digits grouped the way the currency writes them, the caret kept in place.

/** Digits grouped the way the currency writes them: 4,21,805.5 in rupees, 421,805.5 in dollars. */
export function grouped(digits, dollars) {
    const [int = "", dec] = digits.split(".");
    const whole = int.replace(/^0+(?=\d)/, "");
    const out = whole ? BigInt(whole).toLocaleString(dollars ? "en-US" : "en-IN") : dec != null ? "0" : "";
    return dec != null ? `${out}.${dec.slice(0, 2)}` : out;
}

/**
 * What's typed, tidied as it's typed: a leading + or − (an amount to add or take off), then the
 * figure grouped, at most two decimals. The caret stays after the same digit it was after.
 * `signs: false` for a figure that's only ever a figure, a new balance say.
 */
export function regroup(raw, caret, dollars, { signs: allowSigns = true } = {}) {
    const keep = (t) => t.replace(/[^\d.+\-−]/g, "");
    const clean = keep(raw);
    // the last sign typed wins, wherever it was typed: "+" after a figure turns it into an amount to add
    const signs = clean.match(/[+\-−]/g);
    const sign = signs && allowSigns ? (signs[signs.length - 1] === "+" ? "+" : "−") : "";
    const body = clean.replace(/[+\-−]/g, "");
    const dot = body.indexOf(".");
    const digits = dot < 0 ? body : `${body.slice(0, dot)}.${body.slice(dot + 1).replace(/\./g, "")}`;
    const text = sign + grouped(digits, dollars);
    // the caret: after as many significant characters as were before it
    const before = keep(raw.slice(0, caret)).length;
    let at = 0;
    for (let seen = 0; at < text.length && seen < before; at++) if (/[\d.+−]/.test(text[at])) seen++;
    return { text, caret: at };
}

