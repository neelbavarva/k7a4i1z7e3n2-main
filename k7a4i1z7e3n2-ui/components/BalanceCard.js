"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function BalanceCard({ isExpanded, setIsExpanded, setDialogOpen, balance }) {
    return (
        <Button
            className="flex-1 h-7 cursor-pointer text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            Account Balance
        </Button>
    );
}

export function useBalance() {
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    
    const [cryptoBalance, setCryptoBalance] = useState("");
    const [brokerBalance, setBrokerBalance] = useState("");
    const [totalFunded, setTotalFunded] = useState("");
    const [totalFundedPayouts, setTotalFundedPayouts] = useState("");

    const base = process.env.NEXT_PUBLIC_PROD_LINK || "";
    const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";

    const fetchBalance = async () => {
        try {
            setLoading(true);
            const url = `${base.replace(/\/$/, "")}/balance`;
            const res = await fetch(url, {
                headers: { "x-api-key": apiKey },
            });

            if (res.ok) {
                const data = await res.json();
                setBalance(data);
                setCryptoBalance(data.cryptoBalance?.toString() || "0");
                setBrokerBalance(data.brokerBalance?.toString() || "0");
                setTotalFunded(data.totalFunded?.toString() || "0");
                setTotalFundedPayouts(data.totalFundedPayouts?.toString() || "0");
            } else if (res.status === 404) {
                // No balance exists yet, set defaults
                setBalance({
                    cryptoBalance: 0,
                    brokerBalance: 0,
                    totalFunded: 0,
                    totalFundedPayouts: 0,
                });
                setCryptoBalance("0");
                setBrokerBalance("0");
                setTotalFunded("0");
                setTotalFundedPayouts("0");
            }
        } catch (error) {
            console.error("Failed to fetch balance:", error);
            toast.error("Failed to load balance");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async () => {
        try {
            setLoading(true);
            const url = `${base.replace(/\/$/, "")}/balance`;
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                },
                body: JSON.stringify({
                    cryptoBalance: parseFloat(cryptoBalance) || 0,
                    brokerBalance: parseFloat(brokerBalance) || 0,
                    totalFunded: parseFloat(totalFunded) || 0,
                    totalFundedPayouts: parseFloat(totalFundedPayouts) || 0,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setBalance(data);
                setDialogOpen(false);
                toast.success("Balance updated successfully");
            } else {
                toast.error("Failed to update balance");
            }
        } catch (error) {
            console.error("Failed to save balance:", error);
            toast.error("Failed to update balance");
        } finally {
            setLoading(false);
        }
    };

    const handleDialogClose = (open) => {
        if (!open && balance) {
            // Reset to current values when closing
            setCryptoBalance(balance.cryptoBalance?.toString() || "0");
            setBrokerBalance(balance.brokerBalance?.toString() || "0");
            setTotalFunded(balance.totalFunded?.toString() || "0");
            setTotalFundedPayouts(balance.totalFundedPayouts?.toString() || "0");
        }
        setDialogOpen(open);
    };

    const formatCurrency = (value) => {
        const num = parseFloat(value) || 0;
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
        }).format(num);
    };

    return {
        balance,
        loading,
        dialogOpen,
        setDialogOpen,
        cryptoBalance,
        brokerBalance,
        totalFunded,
        totalFundedPayouts,
        setCryptoBalance,
        setBrokerBalance,
        setTotalFunded,
        setTotalFundedPayouts,
        handleSave,
        handleDialogClose,
        formatCurrency,
    };
}

export function BalanceDialog({ 
    dialogOpen, 
    handleDialogClose, 
    cryptoBalance, 
    setCryptoBalance,
    brokerBalance,
    setBrokerBalance,
    totalFunded,
    setTotalFunded,
    totalFundedPayouts,
    setTotalFundedPayouts,
    loading,
    handleSave 
}) {
    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Account Balance</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-[10px] text-[#4fe3c1] uppercase tracking-wide">
                                Crypto Balance
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                value={cryptoBalance}
                                onChange={(e) => setCryptoBalance(e.target.value)}
                                disabled={loading}
                                className="text-lg font-bold [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>

                        <div className="space-y-2 text-right">
                            <label className="text-[10px] text-[#7e71f7] uppercase tracking-wide">
                                Broker Balance
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                value={brokerBalance}
                                onChange={(e) => setBrokerBalance(e.target.value)}
                                disabled={loading}
                                className="text-lg font-bold text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] text-[#f4a522] uppercase tracking-wide">
                                Total Funded
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                value={totalFunded}
                                onChange={(e) => setTotalFunded(e.target.value)}
                                disabled={loading}
                                className="text-lg font-bold [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>

                        <div className="space-y-2 text-right">
                            <label className="text-[10px] text-[#fa346f] uppercase tracking-wide">
                                Total Funded Payouts
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                value={totalFundedPayouts}
                                onChange={(e) => setTotalFundedPayouts(e.target.value)}
                                disabled={loading}
                                className="text-lg font-bold text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="-mt-2">
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full cursor-pointer"
                        >
                            {loading ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    );
}

export function BalanceContainer({ isExpanded, balance, formatCurrency, onEdit }) {
    if (!isExpanded) return null;
    
    return (
        <Card className="rounded-md border border-[#1c1c1c] mt-2">
            <div
                className="px-4 py-1 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                onClick={onEdit}
            >
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-wide">
                            Crypto Balance
                        </label>
                        <div className="text-lg font-bold text-[#4fe3c1]">
                            {formatCurrency(balance?.cryptoBalance || 0)}
                        </div>
                    </div>

                    <div className="space-y-1 text-right">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-wide">
                            Broker Balance
                        </label>
                        <div className="text-lg font-bold text-[#7e71f7]">
                            {formatCurrency(balance?.brokerBalance || 0)}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-wide">
                            Total Funded
                        </label>
                        <div className="text-lg font-bold text-[#f4a522]">
                            {formatCurrency(balance?.totalFunded || 0)}
                        </div>
                    </div>

                    <div className="space-y-1 text-right">
                        <label className="text-[10px] text-zinc-400 uppercase tracking-wide">
                            Total Funded Payouts
                        </label>
                        <div className="text-lg font-bold text-[#fa346f]">
                            {formatCurrency(balance?.totalFundedPayouts || 0)}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
