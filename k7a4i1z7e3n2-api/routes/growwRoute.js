const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const GrowwSession = require("../schema/GrowwSession");
const { apiKeyMiddleware } = require("../middleware");
const market = require("../market");

// Groww, read only, on the free API tier: holdings, positions and funds. There's no login page;
// you approve the API key on Groww Cloud once a day, and the first read after that trades the
// key and secret (GROWW_API_KEY, GROWW_API_SECRET) for the day's token, kept here encrypted.
// The free tier has no prices, so holdings are valued with delayed NSE/BSE prices (market.js).

const API = "https://api.groww.in";
const ID = "groww";

const config = () => ({ key: (process.env.GROWW_API_KEY || "").trim(), secret: (process.env.GROWW_API_SECRET || "").trim() });
const isConfigured = () => Boolean(config().key && config().secret);
const live = (doc) => Boolean(doc?.token && doc.expiresAt && new Date(doc.expiresAt).getTime() > Date.now());
const getState = () => GrowwSession.findById(ID).lean();
const setState = (fields) => GrowwSession.findByIdAndUpdate(ID, { $set: fields }, { upsert: true, new: true }).lean();

class GrowwError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code || "";
    }
    get auth() {
        return this.status === 401 || this.status === 403;
    }
}

async function call(path, { token, method = "GET", query, json } = {}) {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
    const headers = { Accept: "application/json", Authorization: `Bearer ${token}`, "X-API-VERSION": "1.0" };
    if (json) headers["Content-Type"] = "application/json";
    let res;
    try {
        res = await fetch(url, { method, headers, body: json ? JSON.stringify(json) : undefined, signal: AbortSignal.timeout(15000) });
    } catch {
        throw new GrowwError(504, "Groww didn't answer in time");
    }
    let out = null;
    try {
        out = await res.json();
    } catch {
        // not JSON: handled below
    }
    if (!res.ok || out?.status === "FAILURE") {
        throw new GrowwError(res.status, out?.error?.message || out?.message || `Groww answered ${res.status}`, out?.error?.code);
    }
    return out;
}

/** Today's token: the stored one, or a fresh one if the key was approved on Groww Cloud today. */
async function token({ fresh = false } = {}) {
    const doc = fresh ? null : await getState();
    if (live(doc)) return market.unseal(doc.token, config().secret);
    const { key, secret } = config();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const checksum = crypto.createHash("sha256").update(secret + timestamp).digest("hex");
    let out;
    try {
        out = await call("/v1/token/api/access", { token: key, method: "POST", json: { key_type: "approval", checksum, timestamp } });
    } catch (err) {
        if (err.auth || err.status === 400) throw new GrowwError(401, "Approve the API key on Groww Cloud for today", "approve");
        throw err;
    }
    const access = out?.token || out?.payload?.token;
    if (!access) throw new GrowwError(401, "Approve the API key on Groww Cloud for today", "approve");
    await setState({ token: market.seal(access, secret), expiresAt: new Date(market.nextIndiaReset()) });
    return access;
}

router.get("/status", apiKeyMiddleware, async (req, res) => {
    try {
        const doc = isConfigured() ? await getState() : null;
        res.json({ configured: isConfigured(), connected: live(doc), expiresAt: live(doc) ? doc.expiresAt : null });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

/** Holdings (with delayed prices), positions in both segments and funds. */
router.get("/account", apiKeyMiddleware, async (req, res) => {
    if (!isConfigured()) return res.status(503).json({ code: "unset", message: "Groww isn't set up on the server" });
    const read = async (t) =>
        Promise.allSettled([
            call("/v1/holdings/user", { token: t }),
            call("/v1/positions/user", { token: t, query: { segment: "CASH" } }),
            call("/v1/positions/user", { token: t, query: { segment: "FNO" } }),
            call("/v1/margins/detail/user", { token: t }),
        ]);
    try {
        let settled = await read(await token());
        // a stored token that Groww no longer takes: try once with a fresh one
        if (settled.some((r) => r.status === "rejected" && r.reason?.auth)) {
            await setState({ token: null, expiresAt: null });
            settled = await read(await token({ fresh: true }));
        }
        const [h, cash, fno, m] = settled;
        const part = (r, pick) => (r.status === "fulfilled" ? { data: pick(r.value?.payload) } : { error: { message: r.reason?.message || "Failed" } });

        const holdings = part(h, (p) => p?.holdings || []);
        if (holdings.data?.length) {
            const px = await market.prices(holdings.data.map((x) => x.trading_symbol));
            holdings.data = holdings.data.map((x) => {
                const q = px[String(x.trading_symbol).toUpperCase()];
                return { ...x, last_price: q?.price ?? null, close_price: q?.prevClose ?? null, price_time: q?.time ?? null };
            });
        }
        const positions = cash.status === "fulfilled" || fno.status === "fulfilled"
            ? { data: [...(cash.value?.payload?.positions || []).map((p) => ({ ...p, segment: "CASH" })), ...(fno.value?.payload?.positions || []).map((p) => ({ ...p, segment: "FNO" }))] }
            : part(cash, () => []);

        res.json({ fetchedAt: new Date().toISOString(), sections: { holdings, positions, funds: part(m, (p) => p || {}) } });
    } catch (err) {
        if (err instanceof GrowwError && err.code === "approve") return res.status(401).json({ code: "approve", message: err.message });
        if (err instanceof GrowwError) return res.status(502).json({ code: "groww", message: err.message });
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
