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
import { LogOut, Settings2 } from "lucide-react";
import { toast } from "sonner";

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

    // (Edit flows removed by request)

    // Change Key state
    const [ckOldKey, setCkOldKey] = useState("");
    const [ckNewKey, setCkNewKey] = useState("");
    const [ckDoPasswords, setCkDoPasswords] = useState(true);
    const [ckDoCards, setCkDoCards] = useState(true);
    const [ckLoading, setCkLoading] = useState(false);
    const [ckError, setCkError] = useState(null);
    const [ckResult, setCkResult] = useState(null);

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

        // (Edit flows removed)

        setCkOldKey("");
        setCkNewKey("");
        setCkDoPasswords(true);
        setCkDoCards(true);
        setCkLoading(false);
        setCkError(null);
        setCkResult(null);
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

    // (Edit handlers removed)

    async function handleChangeKeys(e) {
        e.preventDefault();
        if (!ckDoPasswords && !ckDoCards) return;
        if (!ckOldKey.trim() || !ckNewKey.trim()) return;
        try {
            setCkLoading(true);
            setCkError(null);
            setCkResult(null);

            const base =
                process.env.NEXT_PUBLIC_PROD_LINK ||
                "https://k7a4i1z7e3n2.onrender.com";
            const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
            const body = {
                oldKey: ckOldKey.trim(),
                newKey: ckNewKey.trim(),
            };
            const results = {};

            if (ckDoPasswords) {
                const urlPw = `${base.replace(/\/$/, "")}/passwords/changeKey`;
                const resPw = await fetch(urlPw, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": apiKey,
                    },
                    body: JSON.stringify(body),
                });
                if (!resPw.ok)
                    throw new Error(
                        `Passwords changeKey failed: ${resPw.status}`
                    );
                const dataPw = await resPw.json();
                results.passwords = dataPw?.summary || dataPw;
            }

            if (ckDoCards) {
                const urlCd = `${base.replace(/\/$/, "")}/cards/changeKey`;
                const resCd = await fetch(urlCd, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": apiKey,
                    },
                    body: JSON.stringify(body),
                });
                if (!resCd.ok)
                    throw new Error(`Cards changeKey failed: ${resCd.status}`);
                const dataCd = await resCd.json();
                results.cards = dataCd?.summary || dataCd;
            }

            const pw = results.passwords;
            const cd = results.cards;
            const lines = [];
            if (pw)
                lines.push(
                    `Passwords updated: ${pw.updated} / processed: ${pw.processed}`
                );
            if (cd)
                lines.push(
                    `Cards updated: ${cd.updated} / processed: ${cd.processed}`
                );
            toast.success("Keys changed", { description: lines.join("\n") });
            setRefreshKey((k) => k + 1);
        } catch (err) {
            console.error(err);
            setCkError(err.message || "Change key failed");
        } finally {
            setCkLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-black text-white">
            <header className="sticky top-0 z-30 flex justify-center px-4 pt-2.5 pb-[3px] bg-gradient-to-b from-black via-black/95 to-transparent">
                <div className="w-full max-w-xl flex justify-center">
                    <div className="w-full max-w-lg rounded-full border border-zinc-800 bg-zinc-950/80 shadow-lg shadow-zinc-900/40 backdrop-blur-md">
                        <div className="flex items-center justify-between px-3 py-[5px] gap-3">
                            <button
                                onClick={onLogout}
                                className="logoutButton px-2 py-0.5 rounded-full text-[11px] font-medium text-zinc-200 transition-colors flex items-center justify-center cursor-pointer"
                                aria-label="Logout"
                            >
                                <LogOut className="w-3 h-3" />
                            </button>

                            <div className="flex-1 flex items-center justify-center gap-1">
                                <button
                                    className={`headerTabTrigger px-4 py-[3px] text-[11px] tracking-wide transition-colors cursor-pointer ${
                                        activeTab === "passwords"
                                            ? "text-white font-semibold"
                                            : "text-white/60 font-normal hover:text-white/80"
                                    }`}
                                    onClick={() => setActiveTab("passwords")}
                                >
                                    Passwords
                                </button>
                                <button
                                    className={`headerTabTrigger px-4 py-[3px] text-[11px] tracking-wide transition-colors cursor-pointer ${
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
                                variant="ghost"
                                className="ml-1 rounded-full text-[11px] font-medium flex items-center justify-center px-2 cursor-pointer bg-transparent hover:bg-transparent border-0"
                                onClick={() => {
                                    setAddMode("password");
                                    resetForms();
                                    setAddOpen(true);
                                }}
                                aria-label="Settings"
                            >
                                <Settings2 className="w-3 h-3" />
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
                        <DialogTitle>Manage</DialogTitle>
                        <DialogDescription>
                            {activeTab === "passwords"
                                ? "Manage your passwords and cards."
                                : "Trades coming soon."}
                        </DialogDescription>
                    </DialogHeader>

                    {activeTab === "trades" ? (
                        <p className="text-xs text-zinc-400">
                            Adding trades is coming soon.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2 rounded-full bg-zinc-900 p-1 text-[10px] font-medium">
                                <button
                                    type="button"
                                    className={`flex-1 rounded-full px-3 py-1 transition-colors cursor-pointer ${
                                        addMode === "password"
                                            ? "bg-white text-black"
                                            : "text-zinc-300 hover:bg-zinc-800"
                                    }`}
                                    onClick={() => setAddMode("password")}
                                >
                                    {"Add\u00a0password"}
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
                                    {"Add\u00a0card"}
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 rounded-full px-3 py-1 transition-colors cursor-pointer ${
                                        addMode === "changeKey"
                                            ? "bg-white text-black"
                                            : "text-zinc-300 hover:bg-zinc-800"
                                    }`}
                                    onClick={() => setAddMode("changeKey")}
                                >
                                    {"Change\u00a0key"}
                                </button>
                            </div>

                            {addMode === "password" ? (
                                <form
                                    onSubmit={handleAddPassword}
                                    className="space-y-3 text-xs"
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
                                            Email
                                        </label>
                                        <Input
                                            type="text"
                                            value={pwEmail}
                                            onChange={(e) =>
                                                setPwEmail(e.target.value)
                                            }
                                            placeholder="username or email"
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
                            ) : addMode === "card" ? (
                                <form
                                    onSubmit={handleAddCard}
                                    className="space-y-3 text-xs"
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
                                            Card name
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
                            ) : addMode === "editPassword" ? (
                                <form
                                    onSubmit={handleEditPassword}
                                    className="space-y-3 text-xs"
                                >
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Password ID
                                        </label>
                                        <Input
                                            value={editPwId}
                                            onChange={(e) =>
                                                setEditPwId(e.target.value)
                                            }
                                            placeholder="Enter password id"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                Name
                                            </label>
                                            <Input
                                                value={editPwName}
                                                onChange={(e) =>
                                                    setEditPwName(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Optional name"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                Email
                                            </label>
                                            <Input
                                                value={editPwEmail}
                                                onChange={(e) =>
                                                    setEditPwEmail(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Optional email"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Category
                                        </label>
                                        <Select
                                            value={editPwCategory}
                                            onValueChange={setEditPwCategory}
                                        >
                                            <SelectTrigger
                                                size="default"
                                                className="w-full cursor-pointer"
                                            >
                                                <SelectValue placeholder="Select category (optional)" />
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
                                            New password
                                        </label>
                                        <Input
                                            type="password"
                                            value={editPwNewPassword}
                                            onChange={(e) =>
                                                setEditPwNewPassword(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Leave blank to keep existing"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Key (required if changing password)
                                        </label>
                                        <Input
                                            type="password"
                                            value={editPwKey}
                                            onChange={(e) =>
                                                setEditPwKey(e.target.value)
                                            }
                                            placeholder="Encryption key"
                                        />
                                    </div>
                                    {editPwError && (
                                        <p className="text-xs text-red-400">
                                            {editPwError}
                                        </p>
                                    )}
                                    <Button
                                        type="submit"
                                        className="w-full cursor-pointer"
                                        disabled={
                                            editPwLoading || !editPwId.trim()
                                        }
                                    >
                                        {editPwLoading
                                            ? "Saving..."
                                            : "Save changes"}
                                    </Button>
                                </form>
                            ) : addMode === "editCard" ? (
                                <form
                                    onSubmit={handleEditCard}
                                    className="space-y-3 text-xs"
                                >
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Card ID
                                        </label>
                                        <Input
                                            value={editCardId}
                                            onChange={(e) =>
                                                setEditCardId(e.target.value)
                                            }
                                            placeholder="Enter card id"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                Bank name
                                            </label>
                                            <Input
                                                value={editCardBankName}
                                                onChange={(e) =>
                                                    setEditCardBankName(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Optional bank name"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                Card name
                                            </label>
                                            <Input
                                                value={editCardCardName}
                                                onChange={(e) =>
                                                    setEditCardCardName(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Optional card name"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                Card number
                                            </label>
                                            <Input
                                                value={editCardNumber}
                                                onChange={(e) =>
                                                    setEditCardNumber(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Leave blank to keep"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                Valid till
                                            </label>
                                            <Input
                                                value={editCardValidTill}
                                                onChange={(e) =>
                                                    setEditCardValidTill(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="MM/YY"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                CVV
                                            </label>
                                            <Input
                                                value={editCardCvv}
                                                onChange={(e) =>
                                                    setEditCardCvv(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="***"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">
                                                PIN
                                            </label>
                                            <Input
                                                value={editCardPin}
                                                onChange={(e) =>
                                                    setEditCardPin(
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="****"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Key (required if changing
                                            number/expiry/cvv/pin)
                                        </label>
                                        <Input
                                            type="password"
                                            value={editCardKey}
                                            onChange={(e) =>
                                                setEditCardKey(e.target.value)
                                            }
                                            placeholder="Encryption key"
                                        />
                                    </div>
                                    {editCardError && (
                                        <p className="text-xs text-red-400">
                                            {editCardError}
                                        </p>
                                    )}
                                    <Button
                                        type="submit"
                                        className="w-full cursor-pointer"
                                        disabled={
                                            editCardLoading ||
                                            !editCardId.trim()
                                        }
                                    >
                                        {editCardLoading
                                            ? "Saving..."
                                            : "Save changes"}
                                    </Button>
                                </form>
                            ) : (
                                <form
                                    onSubmit={handleChangeKeys}
                                    className="space-y-3 text-xs"
                                >
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            Old key
                                        </label>
                                        <Input
                                            type="password"
                                            value={ckOldKey}
                                            onChange={(e) =>
                                                setCkOldKey(e.target.value)
                                            }
                                            placeholder="Enter old key"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">
                                            New key
                                        </label>
                                        <Input
                                            type="password"
                                            value={ckNewKey}
                                            onChange={(e) =>
                                                setCkNewKey(e.target.value)
                                            }
                                            placeholder="Enter new key"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-zinc-300">
                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="accent-white cursor-pointer"
                                                checked={ckDoPasswords}
                                                onChange={(e) =>
                                                    setCkDoPasswords(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                            Passwords
                                        </label>
                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="accent-white cursor-pointer"
                                                checked={ckDoCards}
                                                onChange={(e) =>
                                                    setCkDoCards(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                            Cards
                                        </label>
                                    </div>
                                    {ckError && (
                                        <p className="text-xs text-red-400">
                                            {ckError}
                                        </p>
                                    )}
                                    <Button
                                        type="submit"
                                        className="w-full cursor-pointer"
                                        disabled={
                                            ckLoading ||
                                            !ckNewKey.trim() ||
                                            !ckOldKey.trim() ||
                                            (!ckDoCards && !ckDoPasswords)
                                        }
                                    >
                                        {ckLoading
                                            ? "Changing..."
                                            : "Change key"}
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
