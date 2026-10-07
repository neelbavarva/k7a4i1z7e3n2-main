// The vault's lock, checked here rather than in the browser. The authenticator secret lives only
// in VAULT_TOTP_SECRET on this server; a right code buys a signed session for a day, sent back as
// x-vault-session on every request. Until VAULT_TOTP_SECRET is set nothing is enforced, so the
// old browser-side lock keeps working while this rolls out.
require("dotenv").config();
const crypto = require("crypto");

const DAY_MS = 24 * 60 * 60 * 1000;

const secret = () => (process.env.VAULT_TOTP_SECRET || "").replace(/[\s=-]/g, "").toUpperCase();
const enforced = () => Boolean(secret());

function base32(text) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const out = [];
    for (const ch of text) {
        const i = alphabet.indexOf(ch);
        if (i < 0) continue;
        value = (value << 5) | i;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** The 6-digit code for one 30-second step (RFC 6238, SHA-1, as authenticator apps use). */
function codeAt(key, step) {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(step));
    const h = crypto.createHmac("sha1", key).update(msg).digest();
    const o = h[h.length - 1] & 15;
    const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1e6).padStart(6, "0");
}

/** Accepts this step's code and its neighbours, for a phone clock that's a little off. */
function verifyCode(code, now = Date.now()) {
    if (!enforced() || !/^\d{6}$/.test(String(code || ""))) return false;
    const key = base32(secret());
    const step = Math.floor(now / 30000);
    const want = Buffer.from(String(code));
    return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(codeAt(key, step + d)), want));
}

const signingKey = () => crypto.createHash("sha256").update(`kaizen-vault-session:${secret()}`).digest();
const mac = (body) => crypto.createHmac("sha256", signingKey()).update(body).digest();

function signSession(now = Date.now()) {
    const exp = now + DAY_MS;
    const body = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    return { session: `${body}.${mac(body).toString("base64url")}`, expiresAt: new Date(exp).toISOString() };
}

function verifySession(token, now = Date.now()) {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return false;
    const want = mac(body);
    const got = Buffer.from(sig, "base64url");
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return false;
    try {
        return JSON.parse(Buffer.from(body, "base64url").toString("utf8")).exp > now;
    } catch {
        return false;
    }
}

/** Lets a request through with today's vault session (or while the lock isn't enforced yet). */
function requireVault(req, res, next) {
    if (!enforced() || verifySession(req.headers["x-vault-session"])) return next();
    res.status(401).json({ code: "locked", message: "Unlock the vault" });
}

module.exports = { enforced, verifyCode, codeAt, base32, signSession, verifySession, requireVault };
