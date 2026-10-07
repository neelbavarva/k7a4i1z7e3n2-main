"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Loader2 } from "lucide-react";
import { Mark } from "./k7/Marks";
import { CONNECT_MESSAGE, connectExtension, discoverExtensions, walletOf } from "@/lib/wallets";

// Opened by the vault in the split view (connectInWindow): asks the wallet extension for its public
// addresses here, at the top level where extensions allow it, sends them back to the vault page
// that opened this window, and closes.

const noop = () => () => {};

export default function ConnectWindow() {
    // the query is only known in the browser (the page is built ahead of time): null until then
    const search = useSyncExternalStore(noop, () => window.location.search, () => null);
    return search === null ? null : <Connecting query={new URLSearchParams(search)} />;
}

function Connecting({ query }) {
    const walletId = query.get("wallet") || "other";
    const rdns = query.get("rdns") || "";
    const wallet = walletOf(walletId);
    const [state, setState] = useState({ step: "finding" }); // finding | asking | done | problem
    const extensions = useRef([]);
    const started = useRef(false);

    const ask = useCallback(async () => {
        const opener = window.opener;
        if (!opener) {
            setState({ step: "problem", message: "Open this from the vault’s Add a crypto wallet dialog." });
            return;
        }
        const list = extensions.current;
        const ext = list.find((e) => e.rdns === rdns) || list.find((e) => wallet.rdns.includes(e.rdns)) || (walletId === "other" ? list[0] : null);
        if (!ext) {
            setState({ step: "problem", message: `${wallet.name} isn’t installed in this browser.` });
            return;
        }
        setState({ step: "asking" });
        const { addresses, problems } = await connectExtension(ext, walletId);
        // to the vault page that opened this window, on this site only
        opener.postMessage({ type: CONNECT_MESSAGE, addresses: addresses.map((a) => a.address), problems }, window.location.origin);
        if (addresses.length) {
            setState({ step: "done", count: addresses.length });
            setTimeout(() => window.close(), 900);
        } else {
            setState({ step: "problem", message: problems.join(" · ") || "The extension didn’t share any addresses." });
        }
    }, [rdns, wallet, walletId]);

    // extensions announce themselves (EIP-6963) a moment after load; then ask once
    useEffect(() => {
        const stop = discoverExtensions((ext) => extensions.current.push(ext));
        const id = setTimeout(() => {
            if (started.current) return;
            started.current = true;
            ask();
        }, 450);
        return () => {
            stop();
            clearTimeout(id);
        };
    }, [ask]);

    return (
        <main className="cw">
            <Mark mark={{ wallet: walletId }} size={48} />
            <h1>Connect {wallet.name}</h1>
            <p className="cw-text">Approve it in the extension. Only public addresses go back to the vault; nothing is ever signed.</p>
            <p className={`cw-status is-${state.step}`} role="status">
                {state.step === "done" ? (
                    <>
                        <Check aria-hidden="true" />
                        {state.count} {state.count === 1 ? "address" : "addresses"} sent to the vault
                    </>
                ) : state.step === "problem" ? (
                    state.message
                ) : (
                    <>
                        <Loader2 className="spin" aria-hidden="true" />
                        {state.step === "finding" ? "Finding the extension…" : "Waiting for the extension…"}
                    </>
                )}
            </p>
            {state.step === "problem" && window.opener ? (
                <button type="button" className="btn btn-primary" onClick={ask}>
                    Try again
                </button>
            ) : null}
        </main>
    );
}
