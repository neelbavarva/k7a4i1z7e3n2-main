// Crypto wallets, read only: the wallet apps to pick from, telling a pasted address's chain, and
// getting a wallet's public addresses without typing them, from a browser extension or from a
// phone over WalletConnect. Nothing here asks a wallet to sign or send anything; connecting only
// shares addresses, and the WalletConnect session is closed as soon as they arrive.

/**
 * The wallet apps on offer, most used first. `icon` names one in lib/icons.js; `rdns` matches what
 * an installed extension announces (EIP-6963); `also` is extra words the search knows.
 */
export const WALLETS = [
    { id: "trust", name: "Trust Wallet", icon: "trust", color: "#0500FF", rdns: ["com.trustwallet.app"], chains: ["evm", "btc", "sol", "tron"], phone: true, popular: true },
    { id: "metamask", name: "MetaMask", icon: "metamask", color: "#FF5C16", rdns: ["io.metamask", "io.metamask.flask"], chains: ["evm"], phone: true, popular: true },
    { id: "phantom", name: "Phantom", icon: "phantom", color: "#AB9FF2", rdns: ["app.phantom"], chains: ["sol", "evm", "btc"], phone: true, popular: true },
    { id: "coinbase", name: "Coinbase Wallet", icon: "coinbase", color: "#0052FF", rdns: ["com.coinbase.wallet"], chains: ["evm", "sol"], phone: true, popular: true, also: "base" },
    { id: "okx", name: "OKX Wallet", icon: "okx", color: "#111111", rdns: ["com.okex.wallet"], chains: ["evm", "sol", "btc", "tron"], phone: true, popular: true },
    { id: "exodus", name: "Exodus", icon: "exodus", color: "#5A4FCF", rdns: ["com.exodus.web3-wallet"], chains: ["evm", "sol", "btc"], phone: true },
    { id: "ledger", name: "Ledger", icon: "ledger", color: "#1c1c1c", rdns: ["com.ledger"], chains: ["evm", "btc", "sol", "tron"], phone: true, also: "hardware live" },
    { id: "trezor", name: "Trezor", icon: "trezor", color: "#1c1c1c", rdns: [], chains: ["evm", "btc", "sol"], phone: false, also: "hardware suite" },
    { id: "rabby", name: "Rabby", icon: "rabby", color: "#7084FF", rdns: ["io.rabby"], chains: ["evm"], phone: false },
    { id: "rainbow", name: "Rainbow", icon: "rainbow", color: "#174299", rdns: ["me.rainbow"], chains: ["evm"], phone: true },
    { id: "backpack", name: "Backpack", icon: "backpack", color: "#E33E3F", rdns: ["app.backpack"], chains: ["sol", "evm"], phone: true },
    { id: "solflare", name: "Solflare", icon: "solflare", color: "#FC7227", rdns: ["com.solflare"], chains: ["sol"], phone: true },
    { id: "atomic", name: "Atomic Wallet", icon: "atomic", color: "#1F6FEB", rdns: [], chains: ["evm", "btc", "sol", "tron"], phone: false },
    { id: "zerion", name: "Zerion", icon: "zerion", color: "#2962EF", rdns: ["io.zerion.wallet"], chains: ["evm", "sol"], phone: true },
    { id: "safe", name: "Safe", icon: "safe", color: "#12FF80", rdns: [], chains: ["evm"], phone: true, also: "gnosis multisig" },
    { id: "imtoken", name: "imToken", icon: "imtoken", color: "#11C4D1", rdns: ["im.token"], chains: ["evm", "btc", "tron"], phone: true },
    { id: "token-pocket", name: "TokenPocket", icon: "token-pocket", color: "#2980FE", rdns: ["pro.tokenpocket"], chains: ["evm", "sol", "tron", "btc"], phone: true },
    { id: "coin98", name: "Coin98", icon: "coin98", color: "#D9B432", rdns: ["coin98.com"], chains: ["evm", "sol", "tron"], phone: true },
    { id: "bitbox", name: "BitBox", icon: "bitbox", color: "#1c1c1c", rdns: [], chains: ["evm", "btc"], phone: false, also: "hardware" },
    { id: "argent", name: "Argent", icon: "argent", color: "#FF875B", rdns: [], chains: ["evm"], phone: true },
    { id: "other", name: "Another wallet", icon: null, color: "#7c837a", rdns: [], chains: ["evm", "btc", "sol", "tron"], phone: true, also: "other custom" },
];

export const walletOf = (id) => WALLETS.find((w) => w.id === id) || WALLETS[WALLETS.length - 1];

const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Wallets matching a search, best first: names that start with it, then ones that contain it. */
export function searchWallets(query) {
    const q = words(query);
    if (!q) return WALLETS;
    return WALLETS.filter((w) => words(`${w.name} ${w.also || ""}`).includes(q)).sort((a, b) => Number(!words(a.name).startsWith(q)) - Number(!words(b.name).startsWith(q)));
}

/**
 * The coins a wallet's addresses are read for. Each lives on one chain; one EVM address covers
 * every EVM coin, so picking a second EVM coin needs no new address.
 */
export const COINS = [
    { id: "btc", symbol: "BTC", name: "Bitcoin", token: "BTC", network: "bitcoin", chain: "btc" },
    { id: "eth", symbol: "ETH", name: "Ethereum", token: "ETH", network: "ethereum", chain: "evm", also: "erc20" },
    { id: "usdt-tron", symbol: "USDT", name: "Tether", net: "Tron", token: "USDT", network: "tron", chain: "tron", also: "trc20 trc 20" },
    { id: "sol", symbol: "SOL", name: "Solana", token: "SOL", network: "solana", chain: "sol" },
    { id: "bnb", symbol: "BNB", name: "BNB", net: "BNB Chain", token: "BNB", network: "bsc", chain: "evm", also: "binance bsc bep20" },
    { id: "trx", symbol: "TRX", name: "Tron", token: "TRX", network: "tron", chain: "tron" },
    { id: "pol", symbol: "POL", name: "Polygon", token: "POL", network: "polygon", chain: "evm", also: "matic" },
    { id: "usdt-eth", symbol: "USDT", name: "Tether", net: "Ethereum", token: "USDT", network: "ethereum", chain: "evm", also: "erc20" },
    { id: "usdt-bsc", symbol: "USDT", name: "Tether", net: "BNB Chain", token: "USDT", network: "bsc", chain: "evm", also: "bep20 bsc binance" },
    { id: "usdt-polygon", symbol: "USDT", name: "Tether", net: "Polygon", token: "USDT", network: "polygon", chain: "evm" },
    { id: "usdt-arbitrum", symbol: "USDT", name: "Tether", net: "Arbitrum", token: "USDT", network: "arbitrum", chain: "evm" },
    { id: "usdt-optimism", symbol: "USDT", name: "Tether", net: "Optimism", token: "USDT", network: "optimism", chain: "evm" },
    { id: "usdt-sol", symbol: "USDT", name: "Tether", net: "Solana", token: "USDT", network: "solana", chain: "sol", also: "spl" },
    { id: "usdc-eth", symbol: "USDC", name: "USD Coin", net: "Ethereum", token: "USDC", network: "ethereum", chain: "evm", also: "erc20" },
    { id: "usdc-sol", symbol: "USDC", name: "USD Coin", net: "Solana", token: "USDC", network: "solana", chain: "sol", also: "spl" },
    { id: "usdc-base", symbol: "USDC", name: "USD Coin", net: "Base", token: "USDC", network: "base", chain: "evm" },
    { id: "usdc-bsc", symbol: "USDC", name: "USD Coin", net: "BNB Chain", token: "USDC", network: "bsc", chain: "evm", also: "bep20 bsc" },
    { id: "usdc-polygon", symbol: "USDC", name: "USD Coin", net: "Polygon", token: "USDC", network: "polygon", chain: "evm" },
    { id: "usdc-arbitrum", symbol: "USDC", name: "USD Coin", net: "Arbitrum", token: "USDC", network: "arbitrum", chain: "evm" },
    { id: "usdc-optimism", symbol: "USDC", name: "USD Coin", net: "Optimism", token: "USDC", network: "optimism", chain: "evm" },
    { id: "eth-arbitrum", symbol: "ETH", name: "Ether", net: "Arbitrum", token: "ETH", network: "arbitrum", chain: "evm" },
    { id: "eth-base", symbol: "ETH", name: "Ether", net: "Base", token: "ETH", network: "base", chain: "evm" },
    { id: "eth-optimism", symbol: "ETH", name: "Ether", net: "Optimism", token: "ETH", network: "optimism", chain: "evm" },
];

/** Coins matching a search: symbol, name, network or a nickname like "trc20" or "matic". */
export function searchCoins(query) {
    const q = words(query);
    if (!q) return COINS;
    const score = (c) => (words(c.symbol) === q ? 0 : words(c.symbol).startsWith(q) || words(c.name).startsWith(q) ? 1 : 2);
    return COINS.filter((c) => words(`${c.symbol} ${c.name} ${c.net || ""} ${c.also || ""}`).includes(q)).sort((a, b) => score(a) - score(b));
}

/** What one address on each chain is read for, for showing an address as coins. */
export const CHAIN_INFO = {
    evm: { name: "Ethereum and EVM", token: "ETH", networks: ["ethereum", "bsc", "polygon", "arbitrum", "base", "optimism"], coins: "ETH, BNB, POL, USDT, USDC", hint: "starts with 0x", example: "0x…" },
    btc: { name: "Bitcoin", token: "BTC", networks: ["bitcoin"], coins: "BTC", hint: "starts with bc1, 1 or 3", example: "bc1…" },
    tron: { name: "Tron", token: "TRX", networks: ["tron"], coins: "TRX, USDT", hint: "starts with T", example: "T…" },
    sol: { name: "Solana", token: "SOL", networks: ["solana"], coins: "SOL, USDT, USDC", hint: "a 32 to 44 letter key", example: "Solana address" },
};

/** The icon for a network as the server names it ("BNB Chain" → bsc). */
export const NETWORK_KEY = { Ethereum: "ethereum", "BNB Chain": "bsc", Polygon: "polygon", Arbitrum: "arbitrum", Base: "base", Optimism: "optimism", Solana: "solana", Tron: "tron", Bitcoin: "bitcoin" };
export const NATIVE = { ethereum: "ETH", bsc: "BNB", polygon: "POL", arbitrum: "ETH", base: "ETH", optimism: "ETH", solana: "SOL", tron: "TRX", bitcoin: "BTC" };

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
