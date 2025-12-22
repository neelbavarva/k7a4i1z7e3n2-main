"use client";

import React, { useEffect, useState } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "./ui/dialog";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { Spinner } from "./ui/spinner";

export default function Passwords({ refreshKey = 0 }) {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [decryptKey, setDecryptKey] = useState("");
    const [decryptLoading, setDecryptLoading] = useState(false);
    const [decryptError, setDecryptError] = useState(null);
    const [decryptedData, setDecryptedData] = useState(null);

    const [passwords, setPasswords] = useState([]);
    const [passwordsLoading, setPasswordsLoading] = useState(true);
    const [passwordsError, setPasswordsError] = useState(null);

    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [selectedPassword, setSelectedPassword] = useState(null);
    const [passwordDecryptKey, setPasswordDecryptKey] = useState("");
    const [passwordDecryptLoading, setPasswordDecryptLoading] = useState(false);
    const [passwordDecryptError, setPasswordDecryptError] = useState(null);
    const [decryptedPassword, setDecryptedPassword] = useState(null);

    const [categoryFilter, setCategoryFilter] = useState("all");

    useEffect(() => {
        async function fetchCards() {
            try {
                const base =
                    process.env.NEXT_PUBLIC_PROD_LINK ||
                    "https://k7a4i1z7e3n2.onrender.com";
                const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
                const url = `${base.replace(/\/$/, "")}/cards/getCards`;

                const res = await fetch(url, {
                    method: "GET",
                    headers: {
                        "x-api-key": apiKey,
                    },
                });

                if (!res.ok) {
                    throw new Error(`Failed to load cards: ${res.status}`);
                }

                const data = await res.json();
                setCards(Array.isArray(data) ? data : []);
                setError(null);
            } catch (err) {
                console.error(err);
                setError("Could not load cards");
            } finally {
                setLoading(false);
            }
        }

        fetchCards();
    }, [refreshKey]);

    useEffect(() => {
        async function fetchPasswords() {
            try {
                const base =
                    process.env.NEXT_PUBLIC_PROD_LINK ||
                    "https://k7a4i1z7e3n2.onrender.com";
                const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
                const url = `${base.replace(/\/$/, "")}/passwords/getPasswords`;

                const res = await fetch(url, {
                    method: "GET",
                    headers: {
                        "x-api-key": apiKey,
                    },
                });

                if (!res.ok) {
                    throw new Error(`Failed to load passwords: ${res.status}`);
                }

                const data = await res.json();
                setPasswords(Array.isArray(data) ? data : []);
                setPasswordsError(null);
            } catch (err) {
                console.error(err);
                setPasswordsError("Could not load passwords");
            } finally {
                setPasswordsLoading(false);
            }
        }

        fetchPasswords();
    }, [refreshKey]);

    function handleCardClick(card) {
        setSelectedCard(card);
        setDecryptKey("");
        setDecryptError(null);
        setDecryptedData(null);
        setDialogOpen(true);
    }

    function handlePasswordClick(password) {
        setSelectedPassword(password);
        setPasswordDecryptKey("");
        setPasswordDecryptError(null);
        setDecryptedPassword(null);
        setPasswordDialogOpen(true);
    }

    async function handleDecrypt(e) {
        e.preventDefault();
        if (!selectedCard || !decryptKey.trim()) return;

        try {
            setDecryptLoading(true);
            setDecryptError(null);

            const base =
                process.env.NEXT_PUBLIC_PROD_LINK ||
                "https://k7a4i1z7e3n2.onrender.com";
            const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
            const url = `${base.replace(/\/$/, "")}/cards/decryptCard/${
                selectedCard._id
            }`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify({ key: decryptKey.trim() }),
            });

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Decryption failed. Wrong key?");
                }
                if (res.status === 423) {
                    throw new Error(
                        "Too many failed attempts. Please try again later."
                    );
                }
                throw new Error(`Failed to decrypt card: ${res.status}`);
            }

            const data = await res.json();
            setDecryptedData(data);
            setDecryptError(null);
        } catch (err) {
            console.error(err);
            setDecryptError(err.message || "Could not decrypt card");
            setDecryptedData(null);
        } finally {
            setDecryptLoading(false);
        }
    }

    if (loading || passwordsLoading) {
        return (
            <div className="flex justify-center py-10">
                <Spinner className="w-6 h-6 text-zinc-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && <p className="text-sm text-red-400">{error}</p>}

            {!error && cards.length === 0 && (
                <p className="text-sm text-zinc-400">No cards found yet.</p>
            )}

            {cards.length > 0 && (
                <div className="flex gap-4 overflow-x-auto -mt-4 no-scrollbar">
                    {cards.map((card) => (
                        <Card
                            key={card._id}
                            className="min-w-[260px] max-w-xs bg-zinc-950/60 border-zinc-800 rounded-md p-3 cursor-pointer hover:border-zinc-500 transition-colors"
                            onClick={() => handleCardClick(card)}
                        >
                            <CardHeader className="px-0 py-0">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xs text-zinc-300">
                                        {card.cardName || "Card"}
                                    </CardTitle>
                                    <span className="text-xs text-zinc-400">
                                        {card.bankName}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="px-0 pt-0 pb-0 space-y-2">
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                                        Card Number
                                    </p>
                                    <p className="mt-1 mb-4 text-sm text-zinc-200">
                                        **** **** ****{" "}
                                        {card.lastOfNumber || "****"}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-3">
                                    <div>
                                        <p className="text-[11px] text-zinc-500">
                                            Pin
                                        </p>
                                        <p className="text-sm text-zinc-200">
                                            ****
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[11px] text-zinc-500">
                                            Exp Date
                                        </p>
                                        <p className="text-sm text-zinc-200">
                                            **/**
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-zinc-500">
                                            CVV
                                        </p>
                                        <p className="text-sm text-zinc-200">
                                            ***
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="space-y-2 -mt-1">
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar border border-[#1c1c1c] rounded-[6px] p-1.5">
                    <button
                        type="button"
                        className={`cursor-pointer px-3 py-1 rounded-[6px] text-[11px] font-medium transition-colors border whitespace-nowrap shrink-0 ${
                            categoryFilter === "all"
                                ? "bg-white text-black border-white"
                                : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                        }`}
                        onClick={() => setCategoryFilter("all")}
                    >
                        All
                    </button>
                    {PASSWORD_CATEGORIES.map((cat) => (
                        <button
                            key={cat.value}
                            type="button"
                            className={`cursor-pointer px-3 py-1 rounded-[6px] text-[11px] font-medium transition-colors border whitespace-nowrap shrink-0 ${
                                categoryFilter === cat.value
                                    ? "bg-white text-black border-white"
                                    : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                            }`}
                            onClick={() => setCategoryFilter(cat.value)}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {passwordsError && (
                    <p className="text-sm text-red-400">{passwordsError}</p>
                )}

                {!passwordsError && passwords.length === 0 && (
                    <p className="text-sm text-zinc-400">
                        No passwords found yet.
                    </p>
                )}

                {passwords.length > 0 &&
                    (() => {
                        const visible =
                            categoryFilter === "all"
                                ? passwords
                                : passwords.filter(
                                      (pwd) => pwd.category === categoryFilter
                                  );

                        if (visible.length === 0) {
                            return (
                                <p className="text-sm text-zinc-400">
                                    No passwords in this category.
                                </p>
                            );
                        }

                        return (
                            <div className="flex flex-col gap-2">
                                {visible.map((pwd) => (
                                    <Card
                                        key={pwd._id}
                                        className="w-full bg-zinc-950/60 border-zinc-800 cursor-pointer hover:border-zinc-500 transition-colors"
                                        onClick={() => handlePasswordClick(pwd)}
                                    >
                                        <CardHeader>
                                            <CardTitle>{pwd.name}</CardTitle>
                                            <CardDescription>
                                                {pwd.email || "No email"}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-zinc-500">
                                                {pwd.category || "other"}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        );
                    })()}
            </div>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        setTimeout(() => {
                            setSelectedCard(null);
                            setDecryptKey("");
                            setDecryptError(null);
                            setDecryptedData(null);
                            setDecryptLoading(false);
                        }, 0);
                    }
                }}
            >
                <DialogContent>
                    {selectedCard && (
                        <div className="space-y-4 text-sm">
                            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4 ">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-zinc-300">
                                        {selectedCard.cardName || "Card"}
                                    </p>
                                    <span className="text-xs text-zinc-400">
                                        {selectedCard.bankName}
                                    </span>
                                </div>
                                <div className="mt-3 pt-2">
                                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                                        Card Number
                                    </p>
                                    <p className="mt-1 text-sm text-zinc-200">
                                        {decryptedData?.number
                                            ? (decryptedData.number || "")
                                                  .replace(
                                                      /(\d{4})(?=\d)/g,
                                                      "$1 "
                                                  )
                                                  .trim()
                                            : `**** **** **** ${
                                                  selectedCard.lastOfNumber ||
                                                  "****"
                                              }`}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-2 pt-3">
                                    <div>
                                        <p className="text-[11px] text-zinc-500">
                                            Pin
                                        </p>
                                        <p className="text-sm text-zinc-200">
                                            {decryptedData?.pin || "****"}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[11px] text-zinc-500">
                                            Exp Date
                                        </p>
                                        <p className="text-sm text-zinc-200">
                                            {decryptedData?.validTill ||
                                                "**/**"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-zinc-500">
                                            CVV
                                        </p>
                                        <p className="text-sm text-zinc-200">
                                            {decryptedData?.cvv || "***"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <form
                                onSubmit={handleDecrypt}
                                className="space-y-2 "
                            >
                                <div className="space-y-1">
                                    <label className="text-xs text-zinc-400">
                                        Decryption key
                                    </label>
                                    <Input
                                        type="password"
                                        value={decryptKey}
                                        onChange={(e) =>
                                            setDecryptKey(e.target.value)
                                        }
                                        placeholder="Enter key to decrypt"
                                    />
                                </div>

                                {decryptError && (
                                    <p className="text-xs text-red-400">
                                        {decryptError}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full cursor-pointer"
                                    disabled={
                                        decryptLoading || !decryptKey.trim()
                                    }
                                >
                                    {decryptLoading
                                        ? "Decrypting..."
                                        : "Decrypt"}
                                </Button>
                            </form>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={passwordDialogOpen}
                onOpenChange={(open) => {
                    setPasswordDialogOpen(open);
                    if (!open) {
                        setTimeout(() => {
                            setSelectedPassword(null);
                            setPasswordDecryptKey("");
                            setPasswordDecryptError(null);
                            setDecryptedPassword(null);
                            setPasswordDecryptLoading(false);
                        }, 0);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Password details</DialogTitle>
                        <DialogDescription>
                            Enter your key to decrypt and view this password.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPassword && (
                        <div className="space-y-4 text-sm">
                            <div>
                                <p className="font-medium">
                                    {selectedPassword.name}
                                </p>
                                {selectedPassword.email && (
                                    <p className="text-xs text-zinc-500">
                                        {selectedPassword.email}
                                    </p>
                                )}
                                {selectedPassword.category && (
                                    <p className="mt-1 text-xs text-zinc-400">
                                        {selectedPassword.category}
                                    </p>
                                )}
                            </div>

                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (
                                        !selectedPassword ||
                                        !passwordDecryptKey.trim()
                                    )
                                        return;

                                    try {
                                        setPasswordDecryptLoading(true);
                                        setPasswordDecryptError(null);

                                        const base =
                                            process.env.NEXT_PUBLIC_PROD_LINK ||
                                            "https://k7a4i1z7e3n2.onrender.com";
                                        const apiKey =
                                            process.env
                                                .NEXT_PUBLIC_SERVER_KEY || "";
                                        const url = `${base.replace(
                                            /\/$/,
                                            ""
                                        )}/passwords/decryptPassword/${
                                            selectedPassword._id
                                        }`;

                                        const res = await fetch(url, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                                "x-api-key": apiKey,
                                            },
                                            body: JSON.stringify({
                                                key: passwordDecryptKey.trim(),
                                            }),
                                        });

                                        if (!res.ok) {
                                            if (res.status === 401) {
                                                throw new Error(
                                                    "Decryption failed. Wrong key?"
                                                );
                                            }
                                            if (res.status === 423) {
                                                throw new Error(
                                                    "Too many failed attempts. Please try again later."
                                                );
                                            }
                                            throw new Error(
                                                `Failed to decrypt password: ${res.status}`
                                            );
                                        }

                                        const data = await res.json();
                                        setDecryptedPassword(data.password);
                                        setPasswordDecryptError(null);
                                    } catch (err) {
                                        console.error(err);
                                        setPasswordDecryptError(
                                            err.message ||
                                                "Could not decrypt password"
                                        );
                                        setDecryptedPassword(null);
                                    } finally {
                                        setPasswordDecryptLoading(false);
                                    }
                                }}
                                className="space-y-2"
                            >
                                <div className="space-y-1">
                                    <label className="text-xs text-zinc-400">
                                        Decryption key
                                    </label>
                                    <Input
                                        type="password"
                                        value={passwordDecryptKey}
                                        onChange={(e) =>
                                            setPasswordDecryptKey(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Enter key to decrypt"
                                    />
                                </div>

                                {passwordDecryptError && (
                                    <p className="text-xs text-red-400">
                                        {passwordDecryptError}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    size="sm"
                                    className="w-full cursor-pointer"
                                    disabled={
                                        passwordDecryptLoading ||
                                        !passwordDecryptKey.trim()
                                    }
                                >
                                    {passwordDecryptLoading
                                        ? "Decrypting..."
                                        : "Decrypt"}
                                </Button>
                            </form>

                            {decryptedPassword && (
                                <div className="mt-2 space-y-1 rounded-md bg-zinc-900/80 p-3 text-xs">
                                    <p>
                                        <span className="text-zinc-500">
                                            Password:
                                        </span>{" "}
                                        {decryptedPassword}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
