"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Lock, Vault } from "lucide-react";
import Passwords from "./Passwords";
import Finance, { AddMenu } from "./Finance";
import ManageVault from "./ManageVault";
import AddTrade from "./AddTrade";
import Mark from "./k7/Mark";
import SectionTabs from "./k7/SectionTabs";
import { useKey, useScrolled } from "./k7/hooks";
import { fmtTime } from "@/lib/format";
import { banksOf } from "@/lib/cards";
import { hasHandoff } from "@/lib/kite";

export default function Main({ unlockedAt, onLogout }) {
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window === "undefined") return "passwords";
        if (hasHandoff()) return "finance"; // back from the Zerodha login
        const saved = window.localStorage.getItem("mainActiveSection");
        // "trades" is what Finance was called before
        return saved === "finance" || saved === "trades" ? "finance" : "passwords";
    });
    const [vaultKey, setVaultKey] = useState(0);
    const [tradesKey, setTradesKey] = useState(0);
    const [manage, setManage] = useState(null); // null | "password" | "card" | "changeKey"
    const [myBanks, setMyBanks] = useState([]); // banks you already have cards with, most used first
    const onCards = useCallback((cards) => setMyBanks(banksOf(cards)), []);
    const [newTradeOpen, setNewTradeOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false); // Finance's Add menu
    const [ask, setAsk] = useState(null); // what the Add menu asked Finance to open: { what, kind, n }
    const scrolled = useScrolled();
    const bar = useRef(null);

    useEffect(() => {
        localStorage.setItem("mainActiveSection", activeTab);
        window.scrollTo({ top: 0 });
        document.title = `${activeTab === "finance" ? "Finance" : "Vault"} · k7a4i1z7e3n2`;
    }, [activeTab]);

    // the top bar's height, for what sticks under it (Finance's section tabs); two rows on phones
    useLayoutEffect(() => {
        const el = bar.current;
        if (!el) return;
        const set = () => document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
        set();
        const ro = new ResizeObserver(set);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const isVault = activeTab === "passwords";
    const openNew = () => (isVault ? setManage("password") : setAddOpen(true));
    const askFinance = (what, kind) => setAsk((a) => ({ what, kind, n: (a?.n || 0) + 1 }));

    useKey("n", openNew);
    useKey("1", () => setActiveTab("passwords"));
    useKey("2", () => setActiveTab("finance"));

    return (
        <>
            <header className={`topbar${scrolled ? " is-scrolled" : ""}`} ref={bar}>
                <div className="topbar-in">
                    <div className="brand">
                        <Mark />
                        <span className="brand-name">k7a4i1z7e3n2</span>
                    </div>
                    <SectionTabs value={activeTab} onChange={setActiveTab} />
                    <div className="topbar-actions">
                        {isVault ? (
                            <button type="button" className="btn btn-primary" onClick={openNew}>
                                <Vault aria-hidden="true" />
                                <span className="btn-label">Manage vault</span>
                                <kbd>N</kbd>
                            </button>
                        ) : (
                            <AddMenu open={addOpen} onOpenChange={setAddOpen} onTrade={() => setNewTradeOpen(true)} onAsk={askFinance} />
                        )}
                        <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={onLogout}
                            aria-label="Lock"
                            title="Lock"
                        >
                            <Lock />
                        </button>
                    </div>
                </div>
            </header>

            <div className="page">
                <div key={activeTab} className="fade-in">
                    {isVault ? (
                        <Passwords refreshKey={vaultKey} onManage={setManage} onCards={onCards} />
                    ) : (
                        <Finance refreshKey={tradesKey} ask={ask} onNewTrade={() => setNewTradeOpen(true)} />
                    )}
                </div>

                <footer className="footer">
                    <p>
                        {unlockedAt ? <>Unlocked at {fmtTime(unlockedAt)}, locks itself after 24 hours. </> : null}
                        <button type="button" className="linkish" onClick={onLogout}>
                            Lock now
                        </button>
                    </p>
                    <p className="keys" aria-hidden="true">
                        <span>
                            <kbd>N</kbd>
                            {isVault ? "manage vault" : "add"}
                        </span>
                        <span>
                            <kbd>{isVault ? "/" : "P"}</kbd>
                            {isVault ? "search" : "pick pair"}
                        </span>
                        <span>
                            <kbd>1</kbd>
                            <kbd>2</kbd>
                            switch section
                        </span>
                    </p>
                </footer>
            </div>

            <ManageVault
                mode={manage}
                onMode={setManage}
                onClose={() => setManage(null)}
                onSaved={() => setVaultKey((k) => k + 1)}
                myBanks={myBanks}
            />
            <AddTrade
                open={newTradeOpen}
                onClose={() => setNewTradeOpen(false)}
                onSaved={() => setTradesKey((k) => k + 1)}
            />
        </>
    );
}
