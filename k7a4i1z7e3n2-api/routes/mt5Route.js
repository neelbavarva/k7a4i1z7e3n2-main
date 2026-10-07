const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
const { body, param, validationResult } = require("express-validator");
const Mt5Setting = require("../schema/Mt5Setting");
const Mt5Snapshot = require("../schema/Mt5Snapshot");
const { apiKeyMiddleware } = require("../middleware");

// MT5 accounts (Exness, FundingPips, …), read only, from whichever of three places has them:
//   - the Kaizen Reporter add-on in your MT5 terminal, which POSTs the account to /mt5/push every
//     minute (MT5_PUSH_TOKEN). Live, while the terminal runs. Works logged in with the investor
//     password, which can't trade.
//   - Myfxbook (MYFXBOOK_EMAIL, MYFXBOOK_PASSWORD), which tracks accounts with their investor
//     passwords. Free; updates every few minutes, no terminal needed.
//   - MetaApi (METAAPI_TOKEN), if you ever pay for it.
// The same account from two places shows once: the add-on while it's fresh, then the others.
// The vault keeps a name and a counted / not counted choice per account (Mt5Setting, by login).
// A funded prop account trades the firm's money, so one that looks like a prop firm starts out
// not counted.

const PROP = /fundingpips|ftmo|funded|prop|the5ers|topstep/i;
const FRESH_MS = 3 * 60 * 1000; // an add-on report younger than this counts as live

const getJson = async (url, headers = {}) => {
    let res;
    try {
        res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    } catch {
        throw new Error(`${new URL(url).host} didn't answer in time`);
    }
    const out = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(out?.message || `${new URL(url).host} answered ${res.status}`), { status: res.status });
    return out;
};

const side = (t) => (/sell|1$/i.test(String(t)) ? "POSITION_TYPE_SELL" : "POSITION_TYPE_BUY");
const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));

// ---------- the add-on's reports ----------

async function fromPush() {
    const docs = await Mt5Snapshot.find().lean();
    return docs.map((d) => ({
        source: "addon",
        login: String(d.login),
        server: d.server,
        name: d.name,
        live: Date.now() - new Date(d.updatedAt).getTime() < FRESH_MS,
        updatedAt: d.updatedAt,
        info: { balance: d.balance, equity: d.equity, margin: d.margin, freeMargin: d.freeMargin, marginLevel: d.marginLevel, leverage: d.leverage, currency: d.currency, broker: d.company, server: d.server, login: d.login },
        positions: d.positions || [],
        error: null,
    }));
}

const pushToken = () => (process.env.MT5_PUSH_TOKEN || "").trim();
const pushLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown"),
    handler: (req, res) => res.status(429).json({ message: "Too many requests" }),
});

/** The add-on's report. Its own token, since a terminal can't unlock the vault. */
router.post("/push", pushLimiter, async (req, res) => {
    const want = pushToken();
    const got = String(req.headers["x-push-token"] || "");
    const same = want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
    if (!same) return res.status(401).json({ message: "Wrong or missing push token" });

    const b = req.body || {};
    const login = String(b.login || "").replace(/\D/g, "");
    const server = String(b.server || "").slice(0, 80);
    if (!login || !server || num(b.balance) == null || num(b.equity) == null) return res.status(400).json({ message: "Send login, server, balance and equity" });
    const positions = (Array.isArray(b.positions) ? b.positions : []).slice(0, 200).map((p, i) => ({
        id: String(p.ticket ?? i),
        symbol: String(p.symbol || "").slice(0, 32),
        type: side(p.type),
        volume: num(p.volume),
        openPrice: num(p.openPrice),
        currentPrice: num(p.currentPrice),
        profit: num(p.profit),
        swap: num(p.swap),
    }));
    try {
        await Mt5Snapshot.findByIdAndUpdate(
            `${server}:${login}`,
            {
                $set: {
                    login,
                    server,
                    company: String(b.company || "").slice(0, 80),
                    name: String(b.name || "").slice(0, 80),
                    currency: String(b.currency || "USD").slice(0, 8).toUpperCase(),
                    leverage: num(b.leverage),
                    balance: num(b.balance),
                    equity: num(b.equity),
                    margin: num(b.margin),
                    freeMargin: num(b.freeMargin),
                    marginLevel: num(b.marginLevel),
                    positions,
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );
        forget();
        res.json({ ok: true });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

// ---------- Myfxbook ----------

const fx = { session: null }; // Myfxbook sessions last a month but are tied to the login address

const myfxbookSet = () => Boolean((process.env.MYFXBOOK_EMAIL || "").trim() && (process.env.MYFXBOOK_PASSWORD || ""));

async function myfxbook(path, query = {}, retry = true) {
    if (!fx.session) {
        const login = await getJson(
            `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(process.env.MYFXBOOK_EMAIL.trim())}&password=${encodeURIComponent(process.env.MYFXBOOK_PASSWORD)}`
        );
        if (login?.error || !login?.session) throw new Error(`Myfxbook login failed: ${login?.message || "no session"}`);
        fx.session = login.session;
    }
    const qs = new URLSearchParams({ session: fx.session, ...query }).toString();
    const out = await getJson(`https://www.myfxbook.com/api/${path}?${qs}`);
    if (out?.error) {
        if (retry && /session/i.test(out.message || "")) {
            fx.session = null; // expired, or this server's address changed: log in again
            return myfxbook(path, query, false);
        }
        throw new Error(`Myfxbook: ${out.message || "error"}`);
    }
    return out;
}

/** "10/07/2026 14:05" (Myfxbook's format) → an ISO time, as UTC since Myfxbook doesn't say. */
function fxTime(s) {
    const m = String(s || "").match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    return m ? new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5])).toISOString() : null;
}

async function fromMyfxbook() {
    const { accounts = [] } = await myfxbook("get-my-accounts.json");
    return Promise.all(
        accounts.map(async (a) => {
            // the balance stands even if open trades don't load; positions just stay empty
            const trades = await myfxbook("get-open-trades.json", { id: a.id })
                .then((t) => t.openTrades || [])
                .catch(() => []);
            return {
                source: "myfxbook",
                login: String(a.accountId || a.id),
                server: a.server?.name || "",
                name: a.name,
                live: false,
                updatedAt: fxTime(a.lastUpdateDate),
                info: { balance: num(a.balance), equity: num(a.equity), margin: null, freeMargin: null, currency: a.currency || "USD", broker: a.server?.name || "", server: a.server?.name || "", login: a.accountId },
                positions: trades.map((t, i) => ({
                    id: `${a.id}-${i}`,
                    symbol: t.symbol,
                    type: side(t.action),
                    volume: num(t.sizing?.value),
                    openPrice: num(t.openPrice),
                    currentPrice: null,
                    profit: num(t.profit),
                    swap: num(t.swap),
                })),
                error: null,
            };
        })
    );
}

// Myfxbook's free API allows only so many calls a day, and it only updates every few minutes anyway
let fxLast = null;
async function fromMyfxbookCached() {
    if (fxLast && Date.now() - fxLast.at < 10 * 60 * 1000) return fxLast.value;
    const value = await fromMyfxbook();
    fxLast = { at: Date.now(), value };
    return value;
}

// ---------- MetaApi ----------

const PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const metaToken = () => (process.env.METAAPI_TOKEN || "").trim();
const region = (r) => (/^[a-z0-9-]{2,40}$/.test(r || "") ? r : "new-york");

async function fromMetaApi() {
    const h = { "auth-token": metaToken() };
    const list = await getJson(`${PROVISIONING}/users/current/accounts`, h);
    const mt = (Array.isArray(list) ? list : list?.items || []).filter((a) => a?._id);
    return Promise.all(
        mt.map(async (a) => {
            const base = { source: "metaapi", login: String(a.login), server: a.server, name: a.name, live: true, updatedAt: new Date().toISOString(), info: null, positions: [], error: null };
            if (a.state !== "DEPLOYED") return { ...base, error: "Not deployed on MetaApi" };
            const root = `https://mt-client-api-v1.${region(a.region)}.agiliumtrade.ai/users/current/accounts/${encodeURIComponent(a._id)}`;
            const [info, positions] = await Promise.allSettled([getJson(`${root}/account-information`, h), getJson(`${root}/positions`, h)]);
            return {
                ...base,
                info: info.status === "fulfilled" ? info.value : null,
                positions: positions.status === "fulfilled" ? positions.value || [] : [],
                error: info.status === "rejected" ? info.reason.message : null,
            };
        })
    );
}

// ---------- together ----------

const SOURCES = {
    addon: { on: () => Boolean(pushToken()), read: fromPush },
    myfxbook: { on: myfxbookSet, read: fromMyfxbookCached },
    metaapi: { on: () => Boolean(metaToken()), read: fromMetaApi },
};

let last = null; // { at, value }: the page asks on every visit
const forget = () => (last = null);

router.get("/accounts", apiKeyMiddleware, async (req, res) => {
    const on = Object.entries(SOURCES).filter(([, s]) => s.on());
    if (!on.length) return res.status(503).json({ code: "unset", message: "No MT5 source is set up on the server" });
    if (last && Date.now() - last.at < 60 * 1000 && req.query.fresh !== "1") return res.json(last.value);

    const settled = await Promise.allSettled(on.map(([, s]) => s.read()));
    const sources = {};
    const all = [];
    on.forEach(([name], i) => {
        const r = settled[i];
        sources[name] = r.status === "fulfilled" ? { ok: true, accounts: r.value.length } : { ok: false, message: r.reason?.message || "Failed" };
        if (r.status === "fulfilled") all.push(...r.value);
    });

    // one row per login: a live add-on report first, then MetaApi, Myfxbook, an old add-on report
    const rank = (a) => (a.source === "addon" && a.live ? 0 : a.source === "metaapi" ? 1 : a.source === "myfxbook" ? 2 : 3);
    const byLogin = new Map();
    for (const a of all.sort((x, y) => rank(x) - rank(y))) {
        const key = a.login || `${a.source}:${a.name}`;
        if (!byLogin.has(key)) byLogin.set(key, { ...a, also: [] });
        else byLogin.get(key).also.push(a.source);
    }

    // an account's own name, unless it's an email (prop firms name accounts after the login email):
    // then the firm from the server ("FundingPips-SIM1" → "FundingPips") and the login
    const labelOf = (a) => {
        const name = String(a.name || "").trim();
        if (name && !name.includes("@")) return name;
        const firm = String(a.server || a.info?.broker || "").split(/[-\s_]/)[0];
        return `${firm || "MT5"} ${a.login}`.trim();
    };
    const rows = [...byLogin.values()];
    const settings = new Map((await Mt5Setting.find({ _id: { $in: rows.map((a) => `mt5-${a.login}`) } }).lean().catch(() => [])).map((s) => [s._id, s]));
    const accounts = rows.map((a) => {
        const id = `mt5-${a.login}`;
        const s = settings.get(id) || {};
        const looksProp = PROP.test(`${a.server || ""} ${a.name || ""} ${a.info?.broker || ""}`);
        const counted = s.counted == null ? !looksProp : s.counted;
        return { ...a, id, label: s.label || labelOf(a), counted, prop: !counted };
    });

    const value = { fetchedAt: new Date().toISOString(), sources, accounts };
    last = { at: Date.now(), value };
    res.json(value);
});

/** The vault's own settings for one account: its name here, and whether it counts. */
router.put(
    "/accounts/:id",
    apiKeyMiddleware,
    [
        param("id").isString().matches(/^mt5-\d{1,20}$/),
        body("label").optional().isString().trim().isLength({ max: 40 }),
        body("counted").optional({ nullable: true }).isBoolean(),
    ],
    async (req, res) => {
        if (!validationResult(req).isEmpty()) return res.status(400).json({ code: "input", message: "Check the name and the counted setting" });
        const fields = {};
        if (req.body.label !== undefined) fields.label = req.body.label;
        if (req.body.counted !== undefined) fields.counted = req.body.counted;
        try {
            const doc = await Mt5Setting.findByIdAndUpdate(req.params.id, { $set: fields }, { upsert: true, new: true }).lean();
            forget();
            res.json(doc);
        } catch {
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;
/** For tests: drop both caches, so the next read asks the sources again. */
module.exports.forgetCaches = () => {
    last = null;
    fxLast = null;
};
