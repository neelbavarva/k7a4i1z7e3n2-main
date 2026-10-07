const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const Mt5Setting = require("../schema/Mt5Setting");
const { apiKeyMiddleware } = require("../middleware");

// MT5 accounts (Exness, FundingPips, …) read through MetaApi. Only METAAPI_TOKEN lives on the
// server: every account added on MetaApi (with its investor, read-only, password) shows up here
// by itself, read in its own region. What the vault remembers per account (its name here, and
// whether it counts in net worth) is kept in Mongo. A funded prop account trades the firm's money,
// so one whose server or name looks like a prop firm starts out not counted.

const PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const PROP = /fundingpips|ftmo|funded|prop|the5ers|topstep/i;

const token = () => (process.env.METAAPI_TOKEN || "").trim();
const isConfigured = () => Boolean(token());

async function get(url) {
    let res;
    try {
        res = await fetch(url, { headers: { "auth-token": token() }, signal: AbortSignal.timeout(20000) });
    } catch {
        throw new Error("MetaApi didn't answer in time");
    }
    const out = await res.json().catch(() => null);
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw Object.assign(new Error("MetaApi refused the token"), { auth: true });
        throw new Error(res.status === 404 ? "Account not found or not deployed on MetaApi" : out?.message || `MetaApi answered ${res.status}`);
    }
    return out;
}

const client = (region) => `https://mt-client-api-v1.${/^[a-z0-9-]{2,40}$/.test(region || "") ? region : "new-york"}.agiliumtrade.ai`;

let last = null; // { at, value }: MetaApi is slow, and the page asks on every visit
const forget = () => (last = null);

router.get("/accounts", apiKeyMiddleware, async (req, res) => {
    if (!isConfigured()) return res.status(503).json({ code: "unset", message: "MetaApi isn't set up on the server" });
    if (last && Date.now() - last.at < 20000 && req.query.fresh !== "1") return res.json(last.value);

    let list;
    try {
        list = await get(`${PROVISIONING}/users/current/accounts`);
    } catch (err) {
        return res.status(err.auth ? 401 : 502).json({ code: err.auth ? "token" : "metaapi", message: err.message });
    }
    const mt = (Array.isArray(list) ? list : list?.items || []).filter((a) => a?._id);
    const settings = new Map((await Mt5Setting.find({ _id: { $in: mt.map((a) => a._id) } }).lean().catch(() => [])).map((s) => [s._id, s]));

    const accounts = await Promise.all(
        mt.map(async (a) => {
            const s = settings.get(a._id) || {};
            const looksProp = PROP.test(`${a.server || ""} ${a.name || ""}`);
            const base = {
                id: a._id,
                label: s.label || a.name || `MT${a.version || 5} ${a.login}`,
                name: a.name,
                login: a.login,
                server: a.server,
                region: a.region,
                state: a.state,
                connection: a.connectionStatus,
                prop: s.counted == null ? looksProp : !s.counted,
                counted: s.counted == null ? !looksProp : s.counted,
                info: null,
                positions: [],
                error: null,
            };
            if (a.state !== "DEPLOYED") return { ...base, error: "Not deployed on MetaApi. Deploy it there to read it." };
            const root = `${client(a.region)}/users/current/accounts/${encodeURIComponent(a._id)}`;
            const [info, positions] = await Promise.allSettled([get(`${root}/account-information`), get(`${root}/positions`)]);
            return {
                ...base,
                info: info.status === "fulfilled" ? info.value : null,
                positions: positions.status === "fulfilled" ? positions.value || [] : [],
                error: info.status === "rejected" ? info.reason.message : null,
            };
        })
    );
    const value = { fetchedAt: new Date().toISOString(), accounts };
    last = { at: Date.now(), value };
    res.json(value);
});

/** The vault's own settings for one account: its name here, and whether it counts. */
router.put(
    "/accounts/:id",
    apiKeyMiddleware,
    [
        param("id").isString().matches(/^[\w-]{6,64}$/),
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
