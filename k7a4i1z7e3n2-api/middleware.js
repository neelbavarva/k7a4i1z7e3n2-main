require("dotenv").config();
const crypto = require("crypto");
const { requireVault } = require("./vaultAuth");

const DEFAULT_HEADER = "x-api-key";

function parseEnvKeys() {
    if (process.env.SERVER_KEYS) {
        return process.env.SERVER_KEYS.split(",")
            .map((k) => k.trim())
            .filter(Boolean);
    }
    if (process.env.SERVER_KEY) {
        return [process.env.SERVER_KEY];
    }
    return [];
}

function hashKey(key) {
    return crypto
        .createHash("sha256")
        .update(String(key || ""))
        .digest();
}

function isKeyValid(key, allowedHashes) {
    if (!key || !allowedHashes.length) return false;
    const receivedHash = hashKey(key);
    for (const allowed of allowedHashes) {
        try {
            if (crypto.timingSafeEqual(receivedHash, allowed)) return true;
        } catch {
            continue;
        }
    }
    return false;
}

function createApiKeyMiddleware({
    keys = parseEnvKeys(),
    headerName = DEFAULT_HEADER,
    logger = console,
    message = "Unauthorized",
} = {}) {
    const allowedHashes = (keys || []).map(hashKey);
    if (!allowedHashes.length && logger && typeof logger.warn === "function") {
        logger.warn(
            "API key middleware configured with no keys; all requests will be rejected until keys are set."
        );
    }

    return function apiKeyMiddleware(req, res, next) {
        const rawHeader = req.headers[headerName];
        const apiKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

        if (!apiKey || !isKeyValid(apiKey, allowedHashes)) {
            if (logger && typeof logger.warn === "function") {
                logger.warn("Unauthorized API key attempt", {
                    ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
                });
            }
            return res.status(401).json({ error: "error", message });
        }

        req.apiKey = apiKey;
        next();
    };
}

/** The server key alone: only for the lock screen's own routes, before there's a session. */
const apiKeyOnly = createApiKeyMiddleware();

/** The server key and today's vault session (see vaultAuth.js). Every data route uses this. */
function apiKeyMiddleware(req, res, next) {
    apiKeyOnly(req, res, () => requireVault(req, res, next));
}

module.exports = {
    createApiKeyMiddleware,
    apiKeyOnly,
    apiKeyMiddleware,
};
