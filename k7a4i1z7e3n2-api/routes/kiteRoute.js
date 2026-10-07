const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
const KiteSession = require("../schema/KiteSession");
const { apiKeyMiddleware } = require("../middleware");
const kite = require("../kite");

// Zerodha, read only. The login goes:
//   vault → GET /kite/login → Kite's login page → GET /kite/callback (token stored here)
//   → back to the vault with a one-time code in the URL fragment → POST /kite/session
//   → a signed session the vault sends as x-kite-session on every read.
// The access token itself never leaves this server. Placing orders isn't offered: Kite only
// accepts API orders from a registered static IP.

const ID = "kite";
const getState = () => KiteSession.findById(ID).lean();
const setState = (fields) => KiteSession.findByIdAndUpdate(ID, { $set: fields }, { upsert: true, new: true }).lean();
const live = (doc) => Boolean(doc?.token && doc.expiresAt && new Date(doc.expiresAt).getTime() > Date.now());

/** The vault this login returns to: a known deployment, or any local dev server. */
function vaultOrigin(to) {
    const allowed = (process.env.VAULT_URLS || "https://k7a4i1z7e3n2-vault.vercel.app")
        .split(",")
        .map((s) => s.trim().replace(/\/$/, ""))
        .filter(Boolean);
    try {
        const u = new URL(to);
        if (allowed.includes(u.origin)) return u.origin;
        if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return u.origin;
    } catch {
        // not a URL: fall back below
    }
    return allowed[0];
}

const handoffLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown"),
    handler: (req, res) => res.status(429).json({ message: "Too many requests" }),
});

/** Is Kite set up, and is there a live login today? Nothing personal: any vault may ask. */
router.get("/status", apiKeyMiddleware, async (req, res) => {
    try {
        const doc = kite.isConfigured() ? await getState() : null;
        res.json({
            configured: kite.isConfigured(),
            connected: live(doc),
            expiresAt: live(doc) ? doc.expiresAt : null,
        });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/login", (req, res) => {
    if (!kite.isConfigured()) return res.status(503).json({ code: "unset", message: "Kite isn't set up on the server" });
    res.redirect(kite.loginUrl({ to: vaultOrigin(req.query.to) }));
});

router.get("/callback", async (req, res) => {
    const to = vaultOrigin(req.query.to);
    const back = (fragment) => res.redirect(`${to}/#${fragment}`);
    if (!kite.isConfigured()) return back("kite-error=unset");
    const requestToken = typeof req.query.request_token === "string" ? req.query.request_token : "";
    if (req.query.status !== "success" || !requestToken) return back("kite-error=cancelled");

    try {
        const s = await kite.exchange(requestToken);
        if (String(s.user_id || "").toUpperCase() !== kite.config().userId) {
            // someone else's Zerodha account: end their session, keep nothing
            await kite.revoke(s.access_token).catch(() => {});
            return back("kite-error=wrong-account");
        }
        const code = kite.randomCode();
        await setState({
            userId: s.user_id,
            userName: s.user_name || s.user_shortname || "",
            token: kite.seal(s.access_token),
            loginAt: new Date(),
            expiresAt: new Date(kite.nextReset()),
            handoff: { hash: kite.sha256(code), expiresAt: new Date(Date.now() + 2 * 60 * 1000) },
        });
        back(`kite=${code}`);
    } catch {
        back("kite-error=failed");
    }
});

/** Trades the one-time code from the login redirect for this browser's session. */
router.post("/session", handoffLimiter, apiKeyMiddleware, async (req, res) => {
    try {
        const code = typeof req.body?.code === "string" ? req.body.code : "";
        const doc = await getState();
        const h = doc?.handoff;
        if (!code || !h || !live(doc) || new Date(h.expiresAt).getTime() < Date.now() || h.hash !== kite.sha256(code)) {
            return res.status(401).json({ code: "handoff", message: "That sign-in link has expired. Connect again." });
        }
        await setState({ handoff: null }); // one use only
        const exp = new Date(doc.expiresAt).getTime();
        res.json({
            session: kite.signSession({ g: doc.generation || 0, exp }),
            expiresAt: doc.expiresAt,
            userName: doc.userName,
        });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

/** Lets a request through only with this browser's session for today's login. */
async function requireSession(req, res, next) {
    try {
        const pass = kite.verifySession(req.headers["x-kite-session"]);
        const doc = pass ? await getState() : null;
        if (!pass || !doc || pass.g !== (doc.generation || 0)) {
            return res.status(401).json({ code: "session", message: "Connect Zerodha on this device" });
        }
        if (!live(doc)) return res.status(401).json({ code: "expired", message: "The Zerodha login has expired" });
        req.kite = { doc, token: kite.open(doc.token) };
        next();
    } catch {
        res.status(500).json({ message: "Server error" });
    }
}

const authed = [apiKeyMiddleware, requireSession];

/** Turns a Kite failure into an answer; an expired token also clears today's login. */
async function fail(res, err) {
    if (err instanceof kite.KiteError) {
        if (err.expired) {
            await setState({ token: null, expiresAt: null }).catch(() => {});
            return res.status(401).json({ code: "expired", message: "The Zerodha login has expired" });
        }
        if (err.status === 429) return res.status(429).json({ code: "rate", message: "Kite is rate limiting, try again in a moment" });
        if (err.notInPlan) return res.status(403).json({ code: "plan", message: err.message });
        return res.status(502).json({ code: "kite", message: err.message });
    }
    res.status(500).json({ message: "Server error" });
}

const SECTIONS = {
    profile: "/user/profile",
    funds: "/user/margins",
    holdings: "/portfolio/holdings",
    positions: "/portfolio/positions",
    orders: "/orders",
    trades: "/trades",
    gtt: "/gtt/triggers",
    alerts: "/alerts",
    mfHoldings: "/mf/holdings",
    sips: "/mf/sips",
};

/** What today's filled orders cost: Kite's virtual contract note. */
function chargesFor(orders, token) {
    const filled = (orders || []).filter((o) => o.status === "COMPLETE" && o.filled_quantity > 0);
    if (!filled.length) return Promise.resolve([]);
    return kite.call("/charges/orders", {
        token,
        method: "POST",
        json: filled.map((o) => ({
            order_id: o.order_id,
            exchange: o.exchange,
            tradingsymbol: o.tradingsymbol,
            transaction_type: o.transaction_type,
            variety: o.variety,
            product: o.product,
            order_type: o.order_type,
            quantity: o.filled_quantity,
            average_price: o.average_price,
        })),
    });
}

/**
 * Everything about the account in one go. Each part answers on its own, so one that Kite
 * refuses (alerts on an older app, say) leaves the rest standing.
 */
router.get("/account", authed, async (req, res) => {
    const { token, doc } = req.kite;
    const names = Object.keys(SECTIONS);
    const calls = names.map((name) => kite.call(SECTIONS[name], { token }));
    const charges = calls[names.indexOf("orders")].then((orders) => chargesFor(orders, token));
    const settled = await Promise.allSettled([...calls, charges]);

    const expired = settled.find((r) => r.status === "rejected" && r.reason?.expired);
    if (expired) return fail(res, expired.reason);

    const sections = {};
    [...names, "charges"].forEach((name, i) => {
        const r = settled[i];
        sections[name] =
            r.status === "fulfilled"
                ? { data: r.value }
                : { error: { code: r.reason?.notInPlan ? "plan" : "kite", message: r.reason?.message || "Failed" } };
    });
    res.json({ fetchedAt: new Date().toISOString(), expiresAt: doc.expiresAt, sections });
});

const INSTRUMENT = /^[A-Z]{2,4}:[A-Z0-9][A-Z0-9 &._-]{0,40}$/i;

/** Live quotes, up to 10 instruments as EXCHANGE:SYMBOL. Needs the paid Kite Connect plan. */
router.get("/quote", authed, async (req, res) => {
    const list = [].concat(req.query.i || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
    if (!list.length || list.length > 10 || !list.every((s) => INSTRUMENT.test(s))) {
        return res.status(400).json({ code: "input", message: "Ask for 1 to 10 instruments like NSE:INFY" });
    }
    try {
        res.json(await kite.call("/quote", { token: req.kite.token, query: { i: list }, bucket: "quote" }));
    } catch (err) {
        fail(res, err);
    }
});

// how far back each candle size may reach in one request, in days
const INTERVALS = { minute: 60, "3minute": 100, "5minute": 100, "10minute": 100, "15minute": 200, "30minute": 200, "60minute": 400, day: 2000 };

/** Kite reads times as India time, "yyyy-mm-dd hh:mm:ss". */
const istStamp = (ms) => new Date(ms + 5.5 * 36e5).toISOString().slice(0, 19).replace("T", " ");

/** Historical candles for one instrument token. Needs the paid Kite Connect plan. */
router.get("/candles/:token", authed, async (req, res) => {
    const instrument = String(req.params.token);
    const interval = String(req.query.interval || "day");
    if (!/^\d{1,12}$/.test(instrument) || !INTERVALS[interval]) {
        return res.status(400).json({ code: "input", message: "Unknown instrument or candle size" });
    }
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), INTERVALS[interval]);
    const now = Date.now();
    try {
        const data = await kite.call(`/instruments/historical/${instrument}/${interval}`, {
            token: req.kite.token,
            query: { from: istStamp(now - days * 864e5), to: istStamp(now) },
            bucket: "historical",
        });
        const candles = (data?.candles || []).map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));
        res.json({ interval, days, candles });
    } catch (err) {
        fail(res, err);
    }
});

/** Ends today's Zerodha login for every device. */
router.post("/logout", authed, async (req, res) => {
    await kite.revoke(req.kite.token).catch(() => {});
    try {
        await setState({ token: null, expiresAt: null, handoff: null, generation: (req.kite.doc.generation || 0) + 1 });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
