"use client";

import React, { useEffect, useState } from "react";
import Passwords from "./Passwords";
import Trades from "./Trades";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "./ui/select";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { LogOut, Plus } from "lucide-react";

export default function Main({ onLogout }) {
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window === "undefined") return "passwords";

        const saved = window.localStorage.getItem("mainActiveSection");
        if (saved === "passwords" || saved === "trades") {
            return saved;
        }

        return "passwords";
    });

    const [refreshKey, setRefreshKey] = useState(0);

    const last =
        typeof window !== "undefined" ? localStorage.getItem("auth") : null;
    const lastDate = last ? new Date(Number(last)) : null;

    const [addOpen, setAddOpen] = useState(false);
    const [addMode, setAddMode] = useState("password");

    const [pwName, setPwName] = useState("");
    const [pwEmail, setPwEmail] = useState("");
    const [pwCategory, setPwCategory] = useState("");
    const [pwPassword, setPwPassword] = useState("");
    const [pwKey, setPwKey] = useState("");
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState(null);

    const [cardBankName, setCardBankName] = useState("");
    const [cardCardName, setCardCardName] = useState("");
    const [cardNumber, setCardNumber] = useState("");
    const [cardValidTill, setCardValidTill] = useState("");
    const [cardCvv, setCardCvv] = useState("");
    const [cardPin, setCardPin] = useState("");
    const [cardKey, setCardKey] = useState("");
    const [cardLoading, setCardLoading] = useState(false);
    const [cardError, setCardError] = useState(null);

    // Persist active section whenever it changes
    useEffect(() => {
        if (typeof window === "undefined") return;
        localStorage.setItem("mainActiveSection", activeTab);
    }, [activeTab]);

    function resetForms() {
        setPwName("");
        setPwEmail("");
        setPwCategory("");
        setPwPassword("");
        setPwKey("");
        setPwLoading(false);
        setPwError(null);

        setCardBankName("");
        setCardCardName("");
        setCardNumber("");
        setCardValidTill("");
        setCardCvv("");
        setCardPin("");
        setCardKey("");
        setCardLoading(false);
        setCardError(null);
    }

    async function handleAddPassword(e) {
        e.preventDefault();
        if (
            !pwName.trim() ||
            !pwPassword.trim() ||
            !pwKey.trim() ||
            !pwCategory
        )
            return;

        try {
            setPwLoading(true);
            setPwError(null);

            const base =
                process.env.NEXT_PUBLIC_PROD_LINK ||
                "https://k7a4i1z7e3n2.onrender.com";
            const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
            const url = `${base.replace(/\/$/, "")}/passwords/newPassword`;

            const body = {
                name: pwName.trim(),
                password: pwPassword,
                key: pwKey.trim(),
            };
            if (pwEmail.trim()) body.email = pwEmail.trim();
            body.category = pwCategory;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                throw new Error(`Failed to add password: ${res.status}`);
            }

            setAddOpen(false);
            resetForms();
            setRefreshKey((k) => k + 1);
        } catch (err) {
            console.error(err);
            setPwError(err.message || "Could not add password");
        } finally {
            setPwLoading(false);
        }
    }

    async function handleAddCard(e) {
        e.preventDefault();
        if (
            !cardBankName.trim() ||
            !cardNumber.trim() ||
            !cardValidTill.trim() ||
            !cardCvv.trim() ||
            !cardPin.trim() ||
            !cardKey.trim()
        )
            return;

        try {
            setCardLoading(true);
            setCardError(null);

            const base =
                process.env.NEXT_PUBLIC_PROD_LINK ||
                "https://k7a4i1z7e3n2.onrender.com";
            const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
            const url = `${base.replace(/\/$/, "")}/cards/newCard`;

            const body = {
                bankName: cardBankName.trim(),
                cardName: cardCardName.trim() || undefined,
                number: cardNumber.trim(),
                validTill: cardValidTill.trim(),
                cvv: cardCvv.trim(),
                pin: cardPin.trim(),
                key: cardKey.trim(),
            };

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                throw new Error(`Failed to add card: ${res.status}`);
            }

            setAddOpen(false);
            resetForms();
            setRefreshKey((k) => k + 1);
        } catch (err) {
            console.error(err);
            setCardError(err.message || "Could not add card");
        } finally {
            setCardLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-black text-white">
            <header className="sticky top-0 z-30 flex justify-center px-4 pt-3 pb-1 bg-gradient-to-b from-black via-black/95 to-transparent">
                <div className="w-full max-w-3xl flex justify-center">
                    <div className="w-full max-w-2xl rounded-full border border-zinc-800 bg-zinc-950/80 shadow-lg shadow-zinc-900/40 backdrop-blur-md">
                        <div className="flex items-center justify-between px-3 py-1.5 gap-3">
                            <button
                                onClick={onLogout}
                                className="logoutButton px-2 py-1 rounded-full text-[12px] font-medium text-zinc-200 transition-colors flex items-center justify-center cursor-pointer"
                                aria-label="Logout"
                            >
                                <LogOut className="w-3 h-3" />
                            </button>

                            <div className="flex-1 flex items-center justify-center gap-1">
                                <button
                                    className={`headerTabTrigger px-4 py-1 text-[12px] tracking-wide transition-colors cursor-pointer ${
                                        activeTab === "passwords"
                                            ? "text-white font-semibold"
                                            : "text-white/60 font-normal hover:text-white/80"
                                    }`}
                                    onClick={() => setActiveTab("passwords")}
                                >
                                    Passwords
                                </button>
                                <button
                                    className={`headerTabTrigger px-4 py-1 text-[12px] tracking-wide transition-colors cursor-pointer ${
                                        activeTab === "trades"
                                            ? "text-white font-semibold"
                                            : "text-white/60 font-normal hover:text-white/80"
                                    }`}
                                    onClick={() => setActiveTab("trades")}
                                >
                                    Trades
                                </button>
                            </div>

                            <Button
                                size="sm"
                                variant="outline"
                                className="ml-1 rounded-full border-zinc-700 bg-zinc-900 text-[12px] font-medium flex items-center justify-center px-2 cursor-pointer"
                                onClick={() => {
                                    setAddMode("password");
                                    resetForms();
                                    setAddOpen(true);
                                }}
                                aria-label="Add"
                            >
                                <Plus className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    {activeTab === "passwords" ? (
                        <Passwords refreshKey={refreshKey} />
                    ) : (
                        <Trades />
                    )}
                </div>
            </main>

            <Dialog
                open={addOpen}
                onOpenChange={(open) => {
                    setAddOpen(open);
                    if (!open) {
                        setTimeout(() => {
                            resetForms();
                            setPwError(null);
                            setCardError(null);
                        }, 0);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New</DialogTitle>
                        <DialogDescription>
                            {activeTab === "passwords"
                                ? "Create a new password or card."
                                : "Trades coming soon."}
                        </DialogDescription>
                    </DialogHeader>

                    {activeTab === "trades" ? (
                        <p className="text-sm text-zinc-400">
                            Adding trades is coming soon.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2 rounded-full bg-zinc-900 p-1 text-xs font-medium">
                                <button
                                    type="button"
                                    className={`flex-1 rounded-full px-3 py-1 transition-colors cursor-pointer ${
                                        addMode === "password"
                                            ? "bg-white text-black"
                                            : "text-zinc-300 hover:bg-zinc-800"
                                    }`}
                                    onClick={() => setAddMode("password")}
                                >
                                    Add password
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 rounded-full px-3 py-1 transition-colors cursor-pointer ${
                                        addMode === "card"
                                            ? "bg-white text-black"
                                            : "text-zinc-300 hover:bg-zinc-800"
                                    }`}
                                    onClick={() => setAddMode("card")}
                                >
                                    Add card
                                </button>
                            </div>

                            {addMode === "password" ? (
                                <form
                                    onSubmit={handleAddPassword}
                                    className="space-y-3 text-sm"
                                >
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Name
                                        </label>
                                        <Input
                                            value={pwName}
                                            onChange={(e) =>
                                                setPwName(e.target.value)
                                            }
                                            placeholder="Label for this password"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Email (optional)
                                        </label>
                                        <Input
                                            type="email"
                                            value={pwEmail}
                                            onChange={(e) =>
                                                setPwEmail(e.target.value)
                                            }
                                            placeholder="user@example.com"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Category
                                        </label>
                                        <Select
                                            value={pwCategory}
                                            onValueChange={setPwCategory}
                                        >
                                            <SelectTrigger
                                                size="default"
                                                className="w-full cursor-pointer"
                                            >
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PASSWORD_CATEGORIES.map(
                                                    (cat) => (
                                                        <SelectItem
                                                            key={cat.value}
                                                            value={cat.value}
                                                        >
                                                            {cat.label}
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Password
                                        </label>
                                        <Input
                                            type="password"
                                            value={pwPassword}
                                            onChange={(e) =>
                                                setPwPassword(e.target.value)
                                            }
                                            placeholder="Enter password to encrypt"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Encryption key
                                        </label>
                                        <Input
                                            type="password"
                                            value={pwKey}
                                            onChange={(e) =>
                                                setPwKey(e.target.value)
                                            }
                                            placeholder="Key used to encrypt/decrypt"
                                        />
                                    </div>

                                    {pwError && (
                                        <p className="text-xs text-red-400">
                                            {pwError}
                                        </p>
                                    )}

                                    <Button
                                        type="submit"
                                        size="default"
                                        className="w-full cursor-pointer"
                                        disabled={
                                            pwLoading ||
                                            !pwName.trim() ||
                                            !pwPassword.trim() ||
                                            !pwKey.trim() ||
                                            !pwCategory
                                        }
                                    >
                                        {pwLoading
                                            ? "Saving..."
                                            : "Save password"}
                                    </Button>
                                </form>
                            ) : (
                                <form
                                    onSubmit={handleAddCard}
                                    className="space-y-3 text-sm"
                                >
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Bank name
                                        </label>
                                        <Input
                                            value={cardBankName}
                                            onChange={(e) =>
                                                setCardBankName(e.target.value)
                                            }
                                            placeholder="Bank name"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Card name (optional)
                                        </label>
                                        <Input
                                            value={cardCardName}
                                            onChange={(e) =>
                                                setCardCardName(e.target.value)
                                            }
                                            placeholder="Personal label for this card"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Card number
                                        </label>
                                        <Input
                                            value={cardNumber}
                                            onChange={(e) =>
                                                setCardNumber(e.target.value)
                                            }
                                            placeholder="1234 5678 9012 3456"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                Valid till
                                            </label>
                                            <Input
                                                value={cardValidTill}
                                                onChange={(e) =>
                                                    setCardValidTill(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="MM/YY"
                                            />
                                        </div>
                                        <div className="w-20 space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                CVV
                                            </label>
                                            <Input
                                                value={cardCvv}
                                                onChange={(e) =>
                                                    setCardCvv(e.target.value)
                                                }
                                                placeholder="123"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            PIN
                                        </label>
                                        <Input
                                            value={cardPin}
                                            onChange={(e) =>
                                                setCardPin(e.target.value)
                                            }
                                            placeholder="****"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Encryption key
                                        </label>
                                        <Input
                                            type="password"
                                            value={cardKey}
                                            onChange={(e) =>
                                                setCardKey(e.target.value)
                                            }
                                            placeholder="Key used to encrypt/decrypt"
                                        />
                                    </div>

                                    {cardError && (
                                        <p className="text-xs text-red-400">
                                            {cardError}
                                        </p>
                                    )}

                                    <Button
                                        type="submit"
                                        size="default"
                                        className="w-full cursor-pointer"
                                        disabled={
                                            cardLoading ||
                                            !cardBankName.trim() ||
                                            !cardNumber.trim() ||
                                            !cardValidTill.trim() ||
                                            !cardCvv.trim() ||
                                            !cardPin.trim() ||
                                            !cardKey.trim()
                                        }
                                    >
                                        {cardLoading
                                            ? "Saving..."
                                            : "Save card"}
                                    </Button>
                                </form>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
