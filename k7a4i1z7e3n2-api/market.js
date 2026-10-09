// Free market data for valuing things: USD→INR from the ECB (Frankfurter) and delayed NSE/BSE
// prices from Yahoo Finance's chart endpoint. Both are cached, so a page of reloads asks once.
const crypto = require("crypto");

const cache = new Map(); // key → { at, value } or { at, pending }

async function cached(key, ms, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ms) return hit.pending || hit.value;
    const pending = fn().then(
        (value) => {
            cache.set(key, { at: Date.now(), value });
            return value;
        },
        (err) => {
            cache.delete(key);
            throw err;
        }
    );
    cache.set(key, { at: Date.now(), pending });
    return pending;
}

const get = async (url, ms = 10000) => {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (kaizen)" }, signal: AbortSignal.timeout(ms) });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return res;
};
const getJson = async (url, ms) => (await get(url, ms)).json();
const getText = async (url, ms) => (await get(url, ms)).text();

// The Gulf currencies aren't in the ECB's set, but each is pegged to the dollar at a fixed rate
// (the Kuwaiti dinar follows a basket, so it isn't here)
const PEGGED = { AED: 3.6725, SAR: 3.75, QAR: 3.64, OMR: 0.3845, BHD: 0.376 };

/**
 * Every currency the ECB publishes (about 30) per US dollar, refreshed hourly (it publishes once a
 * working day), plus the pegged Gulf ones: { base: "USD", date, source, rates: { USD: 1, INR: 96.7, ... } }.
 */
function fxRates() {
    return cached("fx:rates", 60 * 60 * 1000, async () => {
        const j = await getJson("https://api.frankfurter.dev/v1/latest?base=USD");
        const rates = { USD: 1, ...PEGGED };
        for (const [c, r] of Object.entries(j?.rates || {})) if (/^[A-Z]{3}$/.test(c) && Number(r) > 0) rates[c] = Number(r);
        if (!rates.INR) throw new Error("No USD/INR rate");
        return { base: "USD", date: j.date, source: "ECB via Frankfurter", rates };
    });
}

/** Rupees per US dollar (from the same hourly rates). */
async function usdInr() {
    const fx = await fxRates();
    return { rate: fx.rates.INR, date: fx.date, source: fx.source };
}

/** One stock's last price and previous close, NSE first and BSE if NSE doesn't know it. */
function quote(symbol) {
    return cached(`px:${symbol}`, 5 * 60 * 1000, async () => {
        for (const suffix of [".NS", ".BO"]) {
            try {
                const j = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + suffix)}?range=1d&interval=1d`);
                const m = j?.chart?.result?.[0]?.meta;
                if (m && m.regularMarketPrice > 0) {
                    return {
                        price: m.regularMarketPrice,
                        prevClose: m.chartPreviousClose ?? m.previousClose ?? null,
                        time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
                        exchange: suffix === ".NS" ? "NSE" : "BSE",
                    };
                }
            } catch {
                // try the other exchange
            }
        }
        return null;
    });
}

/** Prices for many symbols, five at a time. Unknown ones come back as null. */
async function prices(symbols) {
    const list = [...new Set(symbols.filter(Boolean).map((s) => String(s).toUpperCase()))];
    const out = {};
    for (let i = 0; i < list.length; i += 5) {
        const batch = list.slice(i, i + 5);
        const got = await Promise.all(batch.map((s) => quote(s).catch(() => null)));
        batch.forEach((s, j) => (out[s] = got[j]));
    }
    return out;
}

/** Kite, Groww and the rest: tokens die at 6:00 AM India time (00:30 UTC). */
function nextIndiaReset(now = Date.now()) {
    const d = new Date(now);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 30);
    return today > now ? today : today + 864e5;
}

// AES-256-GCM with a key made from a server secret, for tokens kept in Mongo.
const keyOf = (pass) => crypto.createHash("sha256").update(`kaizen-sealed:${pass}`).digest();

function seal(plain, pass) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", keyOf(pass), iv);
    const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return { iv: iv.toString("hex"), tag: c.getAuthTag().toString("hex"), data: data.toString("hex") };
}

function unseal(box, pass) {
    const d = crypto.createDecipheriv("aes-256-gcm", keyOf(pass), Buffer.from(box.iv, "hex"));
    d.setAuthTag(Buffer.from(box.tag, "hex"));
    return Buffer.concat([d.update(Buffer.from(box.data, "hex")), d.final()]).toString("utf8");
}

const clearCache = () => cache.clear();

module.exports = { usdInr, fxRates, prices, nextIndiaReset, seal, unseal, clearCache, cached, getJson, getText };
