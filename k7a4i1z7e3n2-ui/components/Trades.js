"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { Loader2 } from "lucide-react";

export default function Trades() {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tfFilter, setTfFilter] = useState("all"); // all | lower | higher
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [viewOpen, setViewOpen] = useState(false);
    const base = process.env.NEXT_PUBLIC_PROD_LINK;
    const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";

    const fetchTrades = () => {
        const baseUrl = (base || "").replace(/\/$/, "");
        const url = `${baseUrl}/trades/getTrades`;
        setLoading(true);
        fetch(url, {
            headers: { "x-api-key": apiKey },
        })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((result) => setTrades(Array.isArray(result) ? result : []))
            .catch(() => setTrades([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        return trades.filter((t) => {
            if (tfFilter === "lower" && !t.isLowerTf) return false;
            if (tfFilter === "higher" && t.isLowerTf) return false;
            return true;
        });
    }, [trades, tfFilter]);

    const typeClass = (type) =>
        type === "Long"
            ? "text-[#4fe3c1]"
            : type === "Short"
            ? "text-[#ff5050]"
            : "";

    const statusClass = (status) =>
        status === "Open"
            ? "text-[#4fe3c1]"
            : status === "Closed"
            ? "text-[#7e71f7]"
            : "";

    const gradeFor = (pct) => (pct >= 80 ? "A" : pct >= 70 ? "B" : "C");

    return (
        <div className="mt-2">
            {/* Time Frame Filter Bar */}
            <Card className="rounded-md px-1 py-1">
                <div className="w-full flex flex-row items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`${
                            tfFilter === "all" ? "bg-[#1c1c1c]" : ""
                        } h-7 text-[10px] flex-1 justify-center border-none cursor-pointer hover:bg-[#111]`}
                        onClick={() => setTfFilter("all")}
                    >
                        All Time Frame
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`${
                            tfFilter === "lower" ? "bg-[#1c1c1c]" : ""
                        } h-7 text-[10px] flex-1 justify-center border-none cursor-pointer hover:bg-[#111]`}
                        onClick={() => setTfFilter("lower")}
                    >
                        Lower Time Frame
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`${
                            tfFilter === "higher" ? "bg-[#1c1c1c]" : ""
                        } h-7 text-[10px] flex-1 justify-center border-none cursor-pointer hover:bg-[#111]`}
                        onClick={() => setTfFilter("higher")}
                    >
                        Higher Time Frame
                    </Button>
                </div>
            </Card>

            {/* Trades Table */}
            <Card className="rounded-md mt-2 p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-10 text-[12px]">
                        <Loader2 className="animate-spin mr-2" /> Loading trades
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="text-[10px] font-bold">
                            <tr className="text-[10px] border-b border-[#1c1c1c]">
                                <th className="text-left py-2 px-3 w-[50px]">
                                    %
                                </th>
                                <th className="text-left py-2 px-3">Pair</th>
                                <th className="text-left py-2 px-3">Type</th>
                                <th className="text-left py-2 px-3">Date</th>
                                <th className="text-left py-2 px-3">
                                    Risk/Reward
                                </th>
                                <th className="text-left py-2 px-3">
                                    P&L (USD)
                                </th>
                                <th className="text-left py-2 px-3">
                                    Trade Status
                                </th>
                                <th className="text-left py-2 px-3">
                                    Time Frame
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t) => (
                                <tr
                                    key={t._id}
                                    className="text-[11px] border-b border-[#1c1c1c] cursor-pointer hover:bg-[#0f0f0f]"
                                    onClick={() => {
                                        setSelectedTrade(t);
                                        setViewOpen(true);
                                    }}
                                >
                                    <td className="py-2 px-3">
                                        {t.totalPercentage || 0}%
                                    </td>
                                    <td className="py-2 px-3">
                                        {t.tradeSymbol}
                                    </td>
                                    <td
                                        className={`py-2 px-3 ${typeClass(
                                            t.tradeType
                                        )}`}
                                    >
                                        {t.tradeType}
                                    </td>
                                    <td className="py-2 px-3">
                                        {t.dateOfTrade}
                                    </td>
                                    <td className="py-2 px-3">
                                        {t.riskRewardRatio}
                                    </td>
                                    <td
                                        className={`py-2 px-3 ${
                                            (parseFloat(t.totalPnL) || 0) >= 0
                                                ? "text-[#4fe3c1]"
                                                : "text-[#ff5050]"
                                        }`}
                                    >
                                        {t.totalPnL}
                                    </td>
                                    <td
                                        className={`py-2 px-3 ${statusClass(
                                            t.tradeStatus
                                        )}`}
                                    >
                                        {t.tradeStatus}
                                    </td>
                                    <td className="py-2 px-3">
                                        {t.isLowerTf ? "Lower" : "Higher"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            {/* View Trade Dialog */}
            <Dialog
                open={viewOpen}
                onOpenChange={(o) => {
                    setViewOpen(o);
                    if (!o) setSelectedTrade(null);
                }}
            >
                {selectedTrade ? (
                    <DialogContent className="max-h-[90vh] overflow-y-auto no-scrollbar p-3 sm:p-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <div>{selectedTrade.tradeSymbol}</div>
                                <div className="ml-2 text-[10px]">
                                    <Card
                                        className={`${typeClass(
                                            selectedTrade.tradeType
                                        )} px-2 py-1`}
                                    >
                                        {selectedTrade.tradeType}
                                    </Card>
                                </div>
                            </DialogTitle>
                            <div className="flex pt-2">
                                <div className="mr-2">
                                    <Card
                                        className={`${
                                            selectedTrade.tradeStatus === "Open"
                                                ? "text-[#4fe3c1] bg-[#4fe3c023]"
                                                : "text-[#7e71f7] bg-[#7e71f744]"
                                        } text-[11px] px-2 py-1`}
                                    >
                                        {selectedTrade.tradeStatus}
                                    </Card>
                                </div>
                                <div>
                                    <Card
                                        className={`${
                                            (selectedTrade.totalPercentage ||
                                                0) >= 80
                                                ? "text-[#4fe3c1] bg-[#4fe3c023]"
                                                : (selectedTrade.totalPercentage ||
                                                      0) >= 70
                                                ? "text-[#f4a522] bg-[#f4a32224]"
                                                : "text-[#ff5050] bg-[#ff003721]"
                                        } text-[11px] px-2 py-1`}
                                    >
                                        {gradeFor(
                                            selectedTrade.totalPercentage || 0
                                        )}
                                    </Card>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="flex items-center">
                            <div className="flex items-center text-[12px] mr-4">
                                <div>RR</div>
                                <div className="ml-2">
                                    {selectedTrade.riskRewardRatio}
                                </div>
                            </div>
                            <div className="flex items-center text-[12px] mr-4">
                                <div>PnL</div>
                                <div
                                    className={`${
                                        (parseFloat(selectedTrade.totalPnL) ||
                                            0) >= 0
                                            ? "text-[#4fe3c1]"
                                            : "text-[#ff5050]"
                                    } ml-2`}
                                >
                                    {selectedTrade.totalPnL}
                                </div>
                            </div>
                            <div className="flex items-center text-[12px]">
                                <div>Points</div>
                                <div className="ml-2">
                                    {selectedTrade.totalPercentage || 0}%
                                </div>
                            </div>
                        </div>
                        {selectedTrade.description ? (
                            <div className="text-[12px] pb-2.5">
                                {selectedTrade.description}
                            </div>
                        ) : null}
                        <div className="-mt-4">
                            {selectedTrade.lowTf ? (
                                <div className="rounded-md mt-4">
                                    <div className="px-4 py-2 text-[12px] font-semibold">
                                        {selectedTrade.isLowerTf
                                            ? "15min"
                                            : "4H"}
                                    </div>
                                    <Image
                                        className="rounded-b-md"
                                        src={selectedTrade.lowTf}
                                        alt="chart"
                                        width={900}
                                        height={500}
                                    />
                                </div>
                            ) : null}
                            {selectedTrade.midTf ? (
                                <div className="rounded-md mt-4">
                                    <div className="px-4 py-2 text-[12px] font-semibold">
                                        {selectedTrade.isLowerTf ? "1H" : "1D"}
                                    </div>
                                    <Image
                                        className="rounded-b-md"
                                        src={selectedTrade.midTf}
                                        alt="chart"
                                        width={900}
                                        height={500}
                                    />
                                </div>
                            ) : null}
                            {selectedTrade.highTf ? (
                                <div className="rounded-md mt-4">
                                    <div className="px-4 py-2 text-[12px] font-semibold">
                                        {selectedTrade.isLowerTf ? "4H" : "W"}
                                    </div>
                                    <Image
                                        className="rounded-b-md"
                                        src={selectedTrade.highTf}
                                        alt="chart"
                                        width={900}
                                        height={500}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </DialogContent>
                ) : null}
            </Dialog>
        </div>
    );
}
