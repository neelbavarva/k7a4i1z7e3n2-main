const express = require("express");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");
const argon2 = require("argon2");
const Password = require("../schema/Passoword");
const { apiKeyMiddleware } = require("../middleware");

const router = express.Router();

function httpRequestJson(method, urlString, headers = {}, bodyObj = undefined) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(urlString);
            const opts = {
                method,
                hostname: url.hostname,
                port: url.port || (url.protocol === "http:" ? 80 : 443),
                path: url.pathname + url.search,
                headers: { "Content-Type": "application/json", ...headers },
            };
            const client = url.protocol === "http:" ? http : https;
            const req = client.request(opts, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        const json = JSON.parse(data || "{}");
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json);
                        } else {
                            const err = new Error(
                                json?.message || `HTTP ${res.statusCode}`
                            );
                            err.statusCode = res.statusCode;
                            reject(err);
                        }
                    } catch (e) {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({});
                        } else {
                            const err = new Error(`HTTP ${res.statusCode}`);
                            err.statusCode = res.statusCode;
                            reject(err);
                        }
                    }
                });
            });
            req.on("error", reject);
            if (bodyObj) {
                req.write(JSON.stringify(bodyObj));
            }
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

async function tryDecrypt(prevBaseUrl, prevApiKey, id, key, passwordPayload) {
    const headers = { "x-api-key": prevApiKey };
    if (!passwordPayload)
        throw new Error("Missing encrypted password payload for decrypt");
    const url0 = `${prevBaseUrl}/passwords/decryptPassword`;
    const passwordStr =
        typeof passwordPayload === "string"
            ? passwordPayload
            : JSON.stringify(passwordPayload);
    const payload0 = { password: passwordStr, key };
    const payloadJson = JSON.stringify(payload0);
    const escapedJson = payloadJson.replace(/'/g, "'\\''");
    const curl = `curl -X POST "${url0}" \\
  -H "x-api-key: ${prevApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${escapedJson}' \\
  -i -s -S`;
    console.log("[tryDecrypt] curl to send:\n" + curl);
    const dec0 = await httpRequestJson("POST", url0, headers, payload0);
    if (typeof dec0 === "string") return dec0;
    if (typeof dec0?.password === "string") return dec0.password;
    throw new Error("Decrypt endpoint returned invalid response");
}

async function deriveKey(passphrase, saltBuffer) {
    const key = await argon2.hash(passphrase, {
        salt: saltBuffer,
        raw: true,
        type: argon2.argon2id,
        memoryCost: 1 << 16,
        timeCost: 3,
        parallelism: 1,
        hashLength: 32,
    });
    return key;
}

async function encryptText(plain, passphrase) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = await deriveKey(passphrase, salt);
    try {
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([
            cipher.update(plain, "utf8"),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return {
            salt: salt.toString("hex"),
            iv: iv.toString("hex"),
            tag: tag.toString("hex"),
            data: encrypted.toString("hex"),
        };
    } finally {
        if (Buffer.isBuffer(key)) key.fill(0);
    }
}

// POST /migration/import-passwords
// Body: { prevBaseUrl, prevApiKey, prevKey, newKey }
router.post("/import-passwords", apiKeyMiddleware, async (req, res) => {
    const prevBaseUrl = (
        req.body.prevBaseUrl || "https://server-p375.onrender.com"
    ).replace(/\/$/, "");
    const prevApiKey =
        req.body.prevApiKey ||
        "F3B9z2H0Yg8LmW7pXqT6s5nRd4KJc3vS1aQwZuIoPyExMhDtGkVfArCbNeUlSiOj";
    const newKey = req.body.newKey || "Neel@9427524959";
    const prevKey = req.body.prevKey || newKey;
    const source = (req.body.source || "all").toLowerCase();
    const endpoint =
        source === "active"
            ? "/passwords/getPasswords"
            : source === "archive"
            ? "/passwords/getArchivePasswords"
            : "/passwords/getAllPasswords";

    const summary = {
        total: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        failedItems: [],
        skippedItems: [],
    };
    try {
        const list = await httpRequestJson("GET", `${prevBaseUrl}${endpoint}`, {
            "x-api-key": prevApiKey,
        });
        if (!Array.isArray(list) || list.length === 0) {
            summary.total = 0;
            return res.status(200).json({
                message: "No passwords found on previous API",
                summary,
            });
        }
        summary.total = list.length;
        for (const item of list) {
            try {
                const id = item._id || item.id;
                if (!id)
                    throw new Error("Missing id on previous password item");
                const passwordPayload = item && item.password;
                if (!passwordPayload) {
                    summary.skipped++;
                    summary.skippedItems.push({
                        id: id,
                        name: item?.name,
                        email: item?.email,
                        category: item?.category,
                        reason: "missingPayload",
                    });
                    continue;
                }
                const plain = await tryDecrypt(
                    prevBaseUrl,
                    prevApiKey,
                    id,
                    prevKey,
                    passwordPayload
                );
                if (typeof plain !== "string" || plain.length === 0) {
                    summary.skipped++;
                    summary.skippedItems.push({
                        id: id,
                        name: item?.name,
                        email: item?.email,
                        category: item?.category,
                        reason: "emptyPlain",
                    });
                    continue;
                }
                const exists = await Password.findOne({
                    name: item.name,
                    email: item.email,
                    category: item.category,
                });
                if (exists) {
                    summary.skipped++;
                    summary.skippedItems.push({
                        id: id,
                        name: item?.name,
                        email: item?.email,
                        category: item?.category,
                        reason: "duplicate",
                    });
                    continue;
                }
                const encrypted = await encryptText(plain, newKey);
                const doc = new Password({
                    name: item.name,
                    email: item.email,
                    category: item.category,
                    archive: !!item.archive,
                    password: encrypted,
                });
                await doc.save();
                summary.migrated++;
            } catch (err) {
                summary.failed++;
                const failedId = item?._id || item?.id;
                const failedItem = {
                    id: failedId,
                    name: item?.name,
                    email: item?.email,
                    category: item?.category,
                    error: String(err?.message || err),
                };
                summary.failedItems.push(failedItem);
                summary.errors.push(String(err.message || err));
            }
        }
        return res
            .status(200)
            .json({ message: "Migration completed", summary });
    } catch (err) {
        return res.status(500).json({
            message: "Migration failed",
            error: String(err.message || err),
            summary,
        });
    }
});

module.exports = router;
