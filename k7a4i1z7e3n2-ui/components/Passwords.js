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
} from "./ui/dialog";
import { PASSWORD_CATEGORIES } from "@/lib/categories";
import { Spinner } from "./ui/spinner";
import {
    Globe,
    Mail,
    CreditCard,
    Archive,
    ChevronRight,
    ShieldMinus,
    ListFilter,
    X,
    Copy,
} from "lucide-react";
import { toast } from "sonner";

export default function Passwords({ refreshKey = 0 }) {
    // Cards state
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Card dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [decryptKey, setDecryptKey] = useState("");
    const [decryptLoading, setDecryptLoading] = useState(false);
    const [decryptError, setDecryptError] = useState(null);
    const [decryptedData, setDecryptedData] = useState(null);

    // Passwords state
    const [passwords, setPasswords] = useState([]);
    const [passwordsLoading, setPasswordsLoading] = useState(true);
    const [passwordsError, setPasswordsError] = useState(null);

    // Password dialog state
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [selectedPassword, setSelectedPassword] = useState(null);
    const [passwordDecryptKey, setPasswordDecryptKey] = useState("");
    const [passwordDecryptLoading, setPasswordDecryptLoading] = useState(false);
    const [passwordDecryptError, setPasswordDecryptError] = useState(null);
    const [decryptedPassword, setDecryptedPassword] = useState(null);

    // Filters and modes
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [deleteMode, setDeleteMode] = useState(false);
    const [cardDeleteLoading, setCardDeleteLoading] = useState(false);
    const [passwordDeleteLoading, setPasswordDeleteLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortDirection, setSortDirection] = useState(null); // null | 'asc' | 'desc'

    // Fetch cards
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
                    headers: { "x-api-key": apiKey },
                });

                if (!res.ok)
                    throw new Error(`Failed to load cards: ${res.status}`);

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

    // Fetch passwords
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
                    headers: { "x-api-key": apiKey },
                });

                if (!res.ok)
                    throw new Error(`Failed to load passwords: ${res.status}`);

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

    // Handlers: open dialogs
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

    // Decrypt card
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
                    toast.error("Wrong key", {
                        description:
                            "Card decryption failed. Please check your key.",
                    });
                    throw new Error("Decryption failed. Wrong key?");
                }
                if (res.status === 423) {
                    toast.error("Too many attempts", {
                        description:
                            "Card temporarily locked due to failed attempts.",
                    });
                    throw new Error(
                        "Too many failed attempts. Please try again later."
                    );
                }
                toast.error("Decrypt error", {
                    description: `Failed to decrypt card (${res.status})`,
                });
                throw new Error(`Failed to decrypt card: ${res.status}`);
            }

            const data = await res.json();
            setDecryptedData(data);
            setDecryptError(null);
        } catch (err) {
            console.error(err);
            // toast already shown above for known statuses; show generic if needed
            if (
                !String(err?.message || "").includes("Decryption failed") &&
                !String(err?.message || "").includes("Too many failed attempts")
            ) {
                toast.error("Decrypt error", {
                    description: "Could not decrypt card",
                });
            }
            setDecryptError(null);
            setDecryptedData(null);
        } finally {
            setDecryptLoading(false);
        }
    }

    // Delete actions
    async function deleteCard(cardId) {
        try {
            setCardDeleteLoading(true);
            const base =
                process.env.NEXT_PUBLIC_PROD_LINK ||
                "https://k7a4i1z7e3n2.onrender.com";
            const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
            const url = `${base.replace(/\/$/, "")}/cards/deleteCard/${cardId}`;
            const res = await fetch(url, {
                method: "DELETE",
                headers: { "x-api-key": apiKey },
            });
            if (!res.ok) throw new Error("Failed to delete card");
            setCards((prev) => prev.filter((c) => c._id !== cardId));
            setDialogOpen(false);
        } catch (err) {
            console.error(err);
        } finally {
            setCardDeleteLoading(false);
        }
    }

    async function deletePassword(passwordId) {
        try {
            setPasswordDeleteLoading(true);
            const base =
                process.env.NEXT_PUBLIC_PROD_LINK ||
                "https://k7a4i1z7e3n2.onrender.com";
            const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";
            const url = `${base.replace(
                /\/$/,
                ""
            )}/passwords/deletePassword/${passwordId}`;
            const res = await fetch(url, {
                method: "DELETE",
                headers: { "x-api-key": apiKey },
            });
            if (!res.ok) throw new Error("Failed to delete password");
            setPasswords((prev) => prev.filter((p) => p._id !== passwordId));
            setPasswordDialogOpen(false);
        } catch (err) {
            console.error(err);
        } finally {
            setPasswordDeleteLoading(false);
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
            {error && <p className="text-xs text-red-400">{error}</p>}

            {cards.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto -mt-4 no-scrollbar">
                    {cards.map((card) => {
                        const isLocked =
                            card?.lockedUntil &&
                            new Date(card.lockedUntil).getTime() > Date.now();
                        return (
                            <Card
                                key={card._id}
                                className={`${
                                    isLocked
                                        ? "border-[#f5365c] opacity-50"
                                        : "border-zinc-800 hover:border-zinc-500"
                                } min-w-[300px] max-w-sm bg-zinc-950/60 rounded-md p-3 cursor-pointer transition-colors`}
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
                                <CardContent className="px-0 pt-0 pb-0 space-y-2 leading-relaxed">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                                            Card Number
                                        </p>
                                        <p className="mt-1 mb-4 text-xs text-zinc-200 tracking-[0.15em]">
                                            **** **** ****{" "}
                                            {card.lastOfNumber || "****"}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 pt-3">
                                        <div>
                                            <p className="text-[11px] tracking-wide text-zinc-500">
                                                Pin
                                            </p>
                                            <p className="text-xs text-zinc-200 tracking-widest">
                                                ****
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[11px] tracking-wide text-zinc-500">
                                                Exp Date
                                            </p>
                                            <p className="text-xs text-zinc-200 tracking-widest">
                                                **/**
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] tracking-wide text-zinc-500">
                                                CVV
                                            </p>
                                            <p className="text-xs text-zinc-200 tracking-widest">
                                                ***
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <div className="space-y-2 -mt-2">
                <div className="flex items-center gap-2">
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search passwords"
                        className="h-10 w-full flex-1"
                        aria-label="Search passwords"
                    />
                    <Button
                        onClick={() => {
                            const q = searchQuery.trim();
                            if (q === "") {
                                setSortDirection((prev) =>
                                    prev === "asc" ? "desc" : "asc"
                                );
                            } else {
                                setSearchQuery("");
                            }
                        }}
                        variant="outline"
                        className="cursor-pointer shrink-0 h-10 w-10 rounded-[6px] p-0"
                        aria-label="Sort by created time"
                        title={(() => {
                            const q = searchQuery.trim();
                            if (q !== "") return "Clear search";
                            if (sortDirection === "asc")
                                return "Sort: Ascending";
                            if (sortDirection === "desc")
                                return "Sort: Descending";
                            return "Sort by created time";
                        })()}
                    >
                        {searchQuery.trim() === "" ? (
                            <ListFilter className="w-4 h-4" />
                        ) : (
                            <X className="w-4 h-4" />
                        )}
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar border border-[#1c1c1c] rounded-[6px] p-1.5 flex-1 h-10">
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
                    <Button
                        onClick={() => setDeleteMode((s) => !s)}
                        variant="outline"
                        className={`${
                            deleteMode
                                ? "bg-[#f5365c] text-white border-[#f5365c] hover:bg-[#f5365c]/90"
                                : ""
                        } cursor-pointer shrink-0 h-10 w-10 rounded-[6px] p-0`}
                        aria-label="Remove Mode"
                        title={
                            deleteMode ? "Delete mode: ON" : "Delete mode: OFF"
                        }
                    >
                        <ShieldMinus className="w-4 h-4" />
                    </Button>
                </div>

                {passwordsError && (
                    <p className="text-xs text-red-400">{passwordsError}</p>
                )}

                {passwords.length > 0 &&
                    (() => {
                        const baseList =
                            categoryFilter === "all"
                                ? passwords
                                : passwords.filter(
                                      (pwd) => pwd.category === categoryFilter
                                  );

                        const q = searchQuery.trim().toLowerCase();
                        const visible = q
                            ? baseList.filter((pwd) => {
                                  const name = (pwd.name || "").toLowerCase();
                                  const email = (pwd.email || "").toLowerCase();
                                  const category = (
                                      pwd.category || ""
                                  ).toLowerCase();
                                  return (
                                      name.includes(q) ||
                                      email.includes(q) ||
                                      category.includes(q)
                                  );
                              })
                            : baseList;
                        const sorted = sortDirection
                            ? [...visible].sort((a, b) => {
                                  const ta = new Date(
                                      a.createdAt || 0
                                  ).getTime();
                                  const tb = new Date(
                                      b.createdAt || 0
                                  ).getTime();
                                  return sortDirection === "asc"
                                      ? ta - tb
                                      : tb - ta;
                              })
                            : visible;

                        if (sorted.length === 0) {
                            return null; // render nothing when empty
                        }

                        const getIconForCategory = (cat) => {
                            switch (cat) {
                                case "web-app":
                                    return <Globe className="w-3 h-3" />;
                                case "email":
                                    return <Mail className="w-3 h-3" />;
                                case "banking":
                                    return <CreditCard className="w-3 h-3" />;
                                default:
                                    return <Archive className="w-3 h-3" />;
                            }
                        };

                        return (
                            <div className="flex flex-col gap-1.5">
                                {sorted.map((pwd) => {
                                    const isLocked =
                                        pwd?.lockedUntil &&
                                        new Date(pwd.lockedUntil).getTime() >
                                            Date.now();
                                    return (
                                        <div
                                            key={pwd._id}
                                            className={`w-full flex items-center justify-between gap-2.5 rounded-md border bg-zinc-950/60 transition-colors p-2.5 cursor-pointer ${
                                                isLocked
                                                    ? "border-[#f5365c] opacity-50"
                                                    : "border-zinc-800 hover:border-zinc-500"
                                            }`}
                                            onClick={() =>
                                                handlePasswordClick(pwd)
                                            }
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-md bg-zinc-900 text-zinc-300 flex items-center justify-center shrink-0">
                                                    {getIconForCategory(
                                                        pwd.category
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[11px] text-zinc-200 truncate">
                                                        {pwd.name}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-500 truncate">
                                                        {pwd.email ||
                                                            "No email"}
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
            </div>

            {/* Card Dialog */}
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
                        <div className="space-y-4 text-xs leading-relaxed">
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
                                    <p className="mt-1 text-xs text-zinc-200 tracking-widest">
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
                                        <p className="text-xs text-zinc-200 tracking-wider">
                                            {decryptedData?.pin || "****"}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[11px] text-zinc-500">
                                            Exp Date
                                        </p>
                                        <p className="text-xs text-zinc-200 tracking-wider">
                                            {decryptedData?.validTill ||
                                                "**/**"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-zinc-500">
                                            CVV
                                        </p>
                                        <p className="text-xs text-zinc-200 tracking-wider">
                                            {decryptedData?.cvv || "***"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {!deleteMode ? (
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

                                    {/* Errors shown via toast; no inline message */}

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
                            ) : (
                                <Button
                                    className="w-full cursor-pointer bg-[#f5365c] text-white hover:bg-[#f5365c]/90"
                                    onClick={() =>
                                        selectedCard &&
                                        !cardDeleteLoading &&
                                        deleteCard(selectedCard._id)
                                    }
                                    disabled={cardDeleteLoading}
                                >
                                    {cardDeleteLoading
                                        ? "Deleting..."
                                        : "Delete Card"}
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Password Dialog */}
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
                        <DialogTitle>
                            {selectedPassword?.name || "Password"}
                        </DialogTitle>
                        {selectedPassword?.email && (
                            <DialogDescription>
                                {selectedPassword.email}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {selectedPassword && (
                        <div className="space-y-4 text-xs">
                            <div className="mt-2 rounded-md bg-zinc-900/80 p-3 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <p>
                                        <span className="text-zinc-500">
                                            Password:
                                        </span>{" "}
                                        {decryptedPassword
                                            ? decryptedPassword
                                            : "******"}
                                    </p>
                                    {decryptedPassword && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 cursor-pointer"
                                            onClick={() =>
                                                navigator.clipboard.writeText(
                                                    decryptedPassword
                                                )
                                            }
                                            aria-label="Copy password"
                                            title="Copy password"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {!deleteMode ? (
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
                                                process.env
                                                    .NEXT_PUBLIC_PROD_LINK ||
                                                "https://k7a4i1z7e3n2.onrender.com";
                                            const apiKey =
                                                process.env
                                                    .NEXT_PUBLIC_SERVER_KEY ||
                                                "";
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
                                                    toast.error("Wrong key", {
                                                        description:
                                                            "Password decryption failed. Please check your key.",
                                                    });
                                                    throw new Error(
                                                        "Decryption failed. Wrong key?"
                                                    );
                                                }
                                                if (res.status === 423) {
                                                    toast.error(
                                                        "Too many attempts",
                                                        {
                                                            description:
                                                                "Password temporarily locked due to failed attempts.",
                                                        }
                                                    );
                                                    throw new Error(
                                                        "Too many failed attempts. Please try again later."
                                                    );
                                                }
                                                toast.error("Decrypt error", {
                                                    description: `Failed to decrypt password (${res.status})`,
                                                });
                                                throw new Error(
                                                    `Failed to decrypt password: ${res.status}`
                                                );
                                            }

                                            const data = await res.json();
                                            setDecryptedPassword(data.password);
                                            setPasswordDecryptError(null);
                                        } catch (err) {
                                            console.error(err);
                                            if (
                                                !String(
                                                    err?.message || ""
                                                ).includes(
                                                    "Decryption failed"
                                                ) &&
                                                !String(
                                                    err?.message || ""
                                                ).includes(
                                                    "Too many failed attempts"
                                                )
                                            ) {
                                                toast.error("Decrypt error", {
                                                    description:
                                                        "Could not decrypt password",
                                                });
                                            }
                                            setPasswordDecryptError(null);
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

                                    {/* Errors shown via toast; no inline message */}

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
                            ) : (
                                <Button
                                    size="sm"
                                    className="w-full cursor-pointer bg-[#f5365c] text-white hover:bg-[#f5365c]/90"
                                    onClick={() =>
                                        selectedPassword &&
                                        !passwordDeleteLoading &&
                                        deletePassword(selectedPassword._id)
                                    }
                                    disabled={passwordDeleteLoading}
                                >
                                    {passwordDeleteLoading
                                        ? "Deleting..."
                                        : "Delete Password"}
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
