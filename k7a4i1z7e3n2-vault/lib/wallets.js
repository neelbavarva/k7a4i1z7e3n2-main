// Crypto wallets, read only: the wallet apps to pick from, telling a pasted address's chain, and
// getting a wallet's public addresses without typing them, from a browser extension or from a
// phone over WalletConnect. Nothing here asks a wallet to sign or send anything; connecting only
// shares addresses, and the WalletConnect session is closed as soon as they arrive.

/** The wallet apps on offer. `rdns` matches what an installed extension announces (EIP-6963). */
export const WALLETS = [
    { id: "trust", name: "Trust Wallet", color: "#3375BB", rdns: ["com.trustwallet.app"], chains: ["evm", "btc", "sol", "tron"], phone: true },
    { id: "metamask", name: "MetaMask", color: "#E2761B", rdns: ["io.metamask", "io.metamask.flask"], chains: ["evm"], phone: true },
    { id: "phantom", name: "Phantom", color: "#7C6FE0", rdns: ["app.phantom"], chains: ["sol", "evm", "btc"], phone: true },
    { id: "coinbase", name: "Coinbase Wallet", color: "#0052FF", rdns: ["com.coinbase.wallet"], chains: ["evm", "sol"], phone: true },
    { id: "okx", name: "OKX Wallet", color: "#3a3a3a", rdns: ["com.okex.wallet"], chains: ["evm", "sol", "btc", "tron"], phone: true },
    { id: "rabby", name: "Rabby", color: "#6F7FF5", rdns: ["io.rabby"], chains: ["evm"], phone: false },
    { id: "exodus", name: "Exodus", color: "#5A4FCF", rdns: ["com.exodus.web3-wallet"], chains: ["evm", "sol", "btc"], phone: true },
    { id: "ledger", name: "Ledger", color: "#2b2b2b", rdns: ["com.ledger"], chains: ["evm", "btc", "sol", "tron"], phone: true },
    { id: "other", name: "Another wallet", color: "#7c837a", rdns: [], chains: ["evm", "btc", "sol", "tron"], phone: true },
];

export const walletOf = (id) => WALLETS.find((w) => w.id === id) || WALLETS[WALLETS.length - 1];

export const CHAIN_SHORT = { evm: "EVM", btc: "Bitcoin", tron: "Tron", sol: "Solana" };
export const CHAIN_LONG = { evm: "Ethereum, BNB Chain, Polygon, Arbitrum, Base, Optimism", btc: "Bitcoin", tron: "Tron", sol: "Solana" };

/** Which chain an address is on, from its format (the server uses the same rules). */
export function chainOf(address) {
    const a = String(address || "").trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm";
    if (/^bc1[02-9ac-hj-np-z]{11,71}$/.test(a)) return "btc";
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "tron";
    if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return "btc";
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "sol";
    return null;
}

const keyOf = (a) => (/^0x/i.test(a) ? a.toLowerCase() : a);

/** Addresses with their chains, each once (EVM ones ignore letter case). */
export function uniqueAddresses(list) {
    const seen = new Set();
    const out = [];
    for (const raw of list) {
        const address = String(raw || "").trim();
        if (!address || seen.has(keyOf(address))) continue;
        seen.add(keyOf(address));
        out.push({ address, chain: chainOf(address) });
    }
    return out;
}

/** A pasted block, split on lines, spaces or commas. */
export const parseAddresses = (text) => uniqueAddresses(String(text || "").split(/[\s,;]+/));

export const shortAddress = (a) => (a.length > 16 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

// ---------- browser extensions ----------

/**
 * The wallet extensions installed in this browser, as they announce themselves (EIP-6963): each
 * with its own name and icon. Calls back once per wallet; returns a function that stops listening.
 */
export function discoverExtensions(onFound) {
    if (typeof window === "undefined") return () => {};
    const seen = new Set();
    const on = (e) => {
        const { info, provider } = e.detail || {};
        if (!info?.uuid || !provider || seen.has(info.uuid)) return;
        seen.add(info.uuid);
        onFound({ uuid: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns, provider });
    };
    window.addEventListener("eip6963:announceProvider", on);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", on);
}

/** Solana and Bitcoin sides of the same extension, where it has them. */
function sidecars(walletId) {
    if (typeof window === "undefined") return {};
    const w = window;
    const sol = { phantom: w.phantom?.solana, trust: w.trustwallet?.solana, okx: w.okxwallet?.solana, coinbase: w.coinbaseSolana, exodus: w.exodus?.solana }[walletId];
    const btc = { phantom: w.phantom?.bitcoin, okx: w.okxwallet?.bitcoin }[walletId];
    return { sol, btc };
}

/**
 * Asks an installed extension for its public addresses: every EVM account it shares, plus its
 * Solana and Bitcoin addresses when it has those. Each part that fails or is declined is skipped.
 */
export async function connectExtension(ext, walletId) {
    const found = [];
    const problems = [];
    try {
        const accounts = await ext.provider.request({ method: "eth_requestAccounts" });
        found.push(...(accounts || []));
    } catch (err) {
        problems.push(err?.code === 4001 ? "EVM: declined" : `EVM: ${err?.message || "didn’t answer"}`);
    }
    const { sol, btc } = sidecars(walletId);
    if (sol?.connect) {
        try {
            const r = await sol.connect();
            const key = r?.publicKey || sol.publicKey;
            if (key) found.push(key.toString());
        } catch {
            problems.push("Solana: declined");
        }
    }
    if (btc?.requestAccounts) {
        try {
            const r = await btc.requestAccounts();
            found.push(...(r || []).filter((a) => a.purpose !== "ordinals").map((a) => a.address));
        } catch {
            problems.push("Bitcoin: declined");
        }
    }
    return { addresses: uniqueAddresses(found).filter((a) => a.chain), problems };
}

// ---------- phones, over WalletConnect ----------

export const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

const EVM_CHAINS = ["eip155:1", "eip155:56", "eip155:137", "eip155:42161", "eip155:8453", "eip155:10"];
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** Opening the wallet app straight from a phone browser; desktops scan the QR instead. */
export function deepLink(walletId, uri) {
    const enc = encodeURIComponent(uri);
    return (
        {
            trust: `https://link.trustwallet.com/wc?uri=${enc}`,
            metamask: `https://metamask.app.link/wc?uri=${enc}`,
            phantom: `https://phantom.app/ul/v1/wc?uri=${enc}`,
            coinbase: `https://go.cb-w.com/wc?uri=${enc}`,
            okx: `okx://main/wc?uri=${enc}`,
        }[walletId] || uri
    );
}

/**
 * Starts a WalletConnect pairing that asks only to see accounts. `onUri` gets the pairing link
 * (for the QR code); the promise resolves with the wallet's addresses once it's approved on the
 * phone, and the session is closed straight away. `cancel()` stops waiting.
 */
export function connectPhone({ onUri }) {
    let stopped = false;
    let client = null;
    const done = (async () => {
        const { SignClient } = await import("@walletconnect/sign-client");
        client = await SignClient.init({
            projectId: wcProjectId,
            metadata: {
                name: "Kaizen vault",
                description: "Read-only net worth: sees addresses, never asks to sign",
                url: window.location.origin,
                icons: [`${window.location.origin}/icon.svg`],
            },
        });
        const { uri, approval } = await client.connect({
            optionalNamespaces: {
                eip155: { chains: EVM_CHAINS, methods: [], events: [] },
                solana: { chains: [SOLANA_MAINNET], methods: [], events: [] },
            },
        });
        if (stopped) throw new Error("cancelled");
        onUri(uri);
        const session = await approval();
        const accounts = Object.values(session.namespaces || {}).flatMap((n) => n.accounts || []);
        // "eip155:1:0xabc…" → "0xabc…"
        const addresses = uniqueAddresses(accounts.map((a) => a.split(":").slice(2).join(":"))).filter((a) => a.chain);
        const peer = session.peer?.metadata?.name || "";
        client.disconnect({ topic: session.topic, reason: { code: 6000, message: "Addresses received" } }).catch(() => {});
        return { addresses, peer };
    })();
    return {
        done,
        cancel: () => {
            stopped = true;
            client?.core?.relayer?.transportClose?.().catch?.(() => {});
        },
    };
}

/** The pairing link as an SVG QR code, in the page's ink colour. */
export async function qrSvg(text) {
    const QR = (await import("qrcode")).default;
    return QR.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#161a16", light: "#ffffff00" } });
}
