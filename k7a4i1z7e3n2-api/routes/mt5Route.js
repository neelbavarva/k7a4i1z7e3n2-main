const express = require("express");
const router = express.Router();
const { apiKeyMiddleware } = require("../middleware");

// MT5 accounts (Exness, FundingPips) read through MetaApi, connected there with each account's
// investor (read-only) password. Needs METAAPI_TOKEN and METAAPI_ACCOUNTS as "Label:accountId"
// pairs, comma separated; add ":prop" to a pair for a funded prop account (the firm's money, so
// the net worth page leaves it out of the total). METAAPI_REGION is the accounts' region.

/** "Exness:abc, FundingPips:def:prop" → [{ label, id, prop }] */
function accounts() {
    return (process.env.METAAPI_ACCOUNTS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
            const [label, id, flag] = s.split(":").map((x) => x.trim());
            return { label, id, prop: flag === "prop" || /fundingpips|ftmo|funded|prop/i.test(label) };
        })
        .filter((a) => a.label && a.id && /^[\w-]{6,64}$/.test(a.id));
}

const isConfigured = () => Boolean((process.env.METAAPI_TOKEN || "").trim() && accounts().length);
const base = () => `https://mt-client-api-v1.${(process.env.METAAPI_REGION || "new-york").trim()}.agiliumtrade.ai`;

async function get(path) {
    let res;
    try {
        res = await fetch(base() + path, { headers: { "auth-token": process.env.METAAPI_TOKEN.trim() }, signal: AbortSignal.timeout(20000) });
    } catch {
        throw new Error("MetaApi didn't answer in time");
    }
    const out = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = out?.message || `MetaApi answered ${res.status}`;
        throw new Error(res.status === 404 ? "Account not found or not deployed on MetaApi" : msg);
    }
    return out;
}

let last = null; // { at, value }: MetaApi is slow, and the page asks on every visit

router.get("/accounts", apiKeyMiddleware, async (req, res) => {
    if (!isConfigured()) return res.status(503).json({ code: "unset", message: "MetaApi isn't set up on the server" });
    if (last && Date.now() - last.at < 20000 && req.query.fresh !== "1") return res.json(last.value);
    const list = await Promise.all(
        accounts().map(async (a) => {
            const root = `/users/current/accounts/${encodeURIComponent(a.id)}`;
            const [info, positions] = await Promise.allSettled([get(`${root}/account-information`), get(`${root}/positions`)]);
            return {
                label: a.label,
                prop: a.prop,
                info: info.status === "fulfilled" ? info.value : null,
                positions: positions.status === "fulfilled" ? positions.value || [] : [],
                error: info.status === "rejected" ? info.reason.message : null,
            };
        })
    );
    const value = { fetchedAt: new Date().toISOString(), accounts: list };
    last = { at: Date.now(), value };
    res.json(value);
});

module.exports = router;
module.exports.accounts = accounts;
