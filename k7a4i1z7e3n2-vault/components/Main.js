"use client";

import React, { useEffect, useState } from "react";
import { Lock, Plus } from "lucide-react";
import Passwords from "./Passwords";
import Trades from "./Trades";
import ManageVault from "./ManageVault";
import AddTrade from "./AddTrade";
import Mark from "./k7/Mark";
import Seg from "./k7/Seg";
import { useKey, useScrolled } from "./k7/hooks";
import { fmtTime } from "@/lib/format";

const TABS = [
    { value: "passwords", label: "Vault", title: "Passwords and cards (1)" },
    { value: "trades", label: "Trades", title: "Trade journal (2)" },
];

export default function Main({ onLogout }) {
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window === "undefined") return "passwords";
        const saved = window.localStorage.getItem("mainActiveSection");
        return saved === "trades" ? "trades" : "passwords";
    });
    const [vaultKey, setVaultKey] = useState(0);
    const [tradesKey, setTradesKey] = useState(0);
    const [manage, setManage] = useState(null); // null | "password" | "card" | "changeKey"
    const [newTradeOpen, setNewTradeOpen] = useState(false);
    const scrolled = useScrolled();

    useEffect(() => {
        localStorage.setItem("mainActiveSection", activeTab);
        window.scrollTo({ top: 0 });
    }, [activeTab]);

    const unlockedAt = Number(typeof window !== "undefined" ? localStorage.getItem("auth") : 0);
    const isVault = activeTab === "passwords";
    const openNew = () => (isVault ? setManage("password") : setNewTradeOpen(true));

    useKey("n", openNew);
    useKey("1", () => setActiveTab("passwords"));
    useKey("2", () => setActiveTab("trades"));

    return (
        <>
            <header className={`topbar${scrolled ? " is-scrolled" : ""}`}>
                <div className="topbar-in">
                    <div className="brand">
                        <Mark />
                        <span className="brand-name">k7a4i1z7e3n2</span>
                    </div>
                    <Seg className="tabs" label="Section" options={TABS} value={activeTab} onChange={setActiveTab} />
                    <div className="topbar-actions">
                        <button type="button" className="btn btn-primary" onClick={openNew}>
                            <Plus aria-hidden="true" />
                            <span className="btn-label">{isVault ? "Add to vault" : "New trade"}</span>
                            <kbd>N</kbd>
                        </button>
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
                        <Passwords refreshKey={vaultKey} onManage={setManage} />
                    ) : (
                        <Trades refreshKey={tradesKey} onNew={() => setNewTradeOpen(true)} />
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
                            {isVault ? "add" : "new trade"}
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
            />
            <AddTrade
                open={newTradeOpen}
                onClose={() => setNewTradeOpen(false)}
                onSaved={() => setTradesKey((k) => k + 1)}
            />
        </>
    );
}
