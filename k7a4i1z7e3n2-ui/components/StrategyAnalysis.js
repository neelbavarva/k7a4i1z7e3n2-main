"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { TradeSymbolIconMap } from "./TradeSymbols";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";

export default function StrategyAnalysis() {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pairFilter, setPairFilter] = useState("all");
    const [tfFilter, setTfFilter] = useState("all"); // all | lower | higher
    const [typeFilter, setTypeFilter] = useState("all"); // all | Real | Funded | Demo | Backtest

    const base = process.env.NEXT_PUBLIC_PROD_LINK;
    const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";

    useEffect(() => {
        const baseUrl = (base || "").replace(/\/$/, "");
        const url = `${baseUrl}/trades/getTrades`;
        setLoading(true);
        fetch(url, { headers: { "x-api-key": apiKey } })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((result) => setTrades(Array.isArray(result) ? result : []))
            .catch(() => setTrades([]))
            .finally(() => setLoading(false));
    }, []);

    const allPairs = useMemo(() => {
        const fromTrades = Array.from(
            new Set(
                (trades || [])
                    .map((t) => t.tradeSymbol)
                    .filter((s) => typeof s === "string" && s.length > 0)
            )
        ).sort();
        if (fromTrades.length) return fromTrades;
        return Object.keys(TradeSymbolIconMap).sort();
    }, [trades]);

    const filteredByTfAndType = useMemo(() => {
        return trades
            .filter((t) => {
                if (tfFilter === "lower" && !t.isLowerTf) return false;
                if (tfFilter === "higher" && t.isLowerTf) return false;
                return true;
            })
            .filter((t) => {
                if (typeFilter === "all") return true;
                return String(t.tradeType) === typeFilter;
            });
    }, [trades, tfFilter, typeFilter]);

    function computeAccuracyForPair(pair) {
        const list = filteredByTfAndType.filter((t) =>
            pair === "all" ? true : String(t.tradeSymbol) === pair
        );
        const total = list.length;
        if (total === 0) return 0;
        const wins = list.reduce((acc, t) => {
            const pnl = parseFloat(t.totalPnL) || 0;
            return acc + (pnl > 0 ? 1 : 0);
        }, 0);
        return (wins / total) * 100;
    }

    const ranks = useMemo(() => {
        const pairs = allPairs.slice();
        const withAcc = pairs.map((p) => ({
            pair: p,
            acc: computeAccuracyForPair(p),
        }));
        withAcc.sort((a, b) => {
            if (b.acc !== a.acc) return b.acc - a.acc;
            return a.pair.localeCompare(b.pair);
        });
        const map = new Map();
        withAcc.forEach((item, idx) => map.set(item.pair, idx + 1));
        return map; // pair -> rank number starting from 1
    }, [allPairs, filteredByTfAndType]);

    const selectedRank = pairFilter === "all" ? 0 : ranks.get(pairFilter) || 0;
    const selectedAcc = computeAccuracyForPair(pairFilter);

    function getSelectedList() {
        return filteredByTfAndType.filter((t) =>
            pairFilter === "all" ? true : String(t.tradeSymbol) === pairFilter
        );
    }

    function getTotalTrades() {
        return getSelectedList().length;
    }

    function getTotalProfit() {
        const list = getSelectedList();
        return list.reduce((sum, t) => {
            const pnl = parseFloat(t.totalPnL) || 0;
            return sum + (pnl > 0 ? pnl : 0);
        }, 0);
    }

    function getTotalLossAbs() {
        const list = getSelectedList();
        return list.reduce((sum, t) => {
            const pnl = parseFloat(t.totalPnL) || 0;
            return sum + (pnl < 0 ? -pnl : 0);
        }, 0);
    }

    function getProfitAccuracy() {
        const profit = getTotalProfit();
        const lossAbs = getTotalLossAbs();
        const denom = profit + lossAbs;
        if (denom <= 0) return 0;
        return (profit / denom) * 100;
    }

    return (
        <div className="space-y-3">
            {/* Header: Pair name + optional icon on left, rank on right */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                    {pairFilter !== "all" && TradeSymbolIconMap[pairFilter] ? (
                        <Image
                            width={18}
                            height={18}
                            src={`/icons/${TradeSymbolIconMap[pairFilter]}`}
                            alt={`${pairFilter} icon`}
                        />
                    ) : null}
                    <span className="text-sm">
                        {pairFilter === "all" ? "All Pairs" : pairFilter}
                    </span>
                </div>
                <div className="text-sm font-medium">
                    {pairFilter === "all" || getTotalTrades() === 0 ? (
                        <span className="text-[#ff0000]">N.A</span>
                    ) : (
                        <>#{selectedRank}</>
                    )}
                </div>
            </div>

            {/* Summary metric: show total trades for current selection */}
            <div className="text-[12px] text-zinc-400">
                Total trades: {getTotalTrades()}
            </div>

            {/* Controls: Pair, Timeframe, Trade Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select value={pairFilter} onValueChange={setPairFilter}>
                    <SelectTrigger className="h-10 w-full rounded-[6px] text-[11px] bg-zinc-900 border border-[#1c1c1c] cursor-pointer">
                        <SelectValue placeholder="Pair" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Pairs</SelectItem>
                        {allPairs.map((p) => (
                            <SelectItem key={p} value={p}>
                                <div className="flex items-center gap-2">
                                    {TradeSymbolIconMap[p] ? (
                                        <Image
                                            width={16}
                                            height={16}
                                            src={`/icons/${TradeSymbolIconMap[p]}`}
                                            alt={`${p} icon`}
                                        />
                                    ) : null}
                                    <span>{p}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={tfFilter} onValueChange={setTfFilter}>
                    <SelectTrigger className="h-10 w-full rounded-[6px] text-[11px] bg-zinc-900 border border-[#1c1c1c] cursor-pointer">
                        <SelectValue placeholder="Timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Time Frame</SelectItem>
                        <SelectItem value="lower">Lower Time Frame</SelectItem>
                        <SelectItem value="higher">
                            Higher Time Frame
                        </SelectItem>
                    </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-10 w-full rounded-[6px] text-[11px] bg-zinc-900 border border-[#1c1c1c] cursor-pointer">
                        <SelectValue placeholder="Trade type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {["Real", "Funded", "Demo", "Backtest"].map((t) => (
                            <SelectItem key={t} value={t}>
                                {t}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Graphs: Accuracy and Profit Accuracy */}
            <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Combined container: border wraps graph + label below */}
                <div className="rounded-md border border-[#1c1c1c] p-2">
                    <div
                        className="rounded-md bg-[#1c1c1c]"
                        style={{ aspectRatio: "1 / 1" }}
                    >
                        <div className="h-full w-full px-2 py-3 flex items-center justify-center">
                            <CircleStat label="Accuracy" value={selectedAcc} />
                        </div>
                    </div>
                    <div className="mt-2 text-center text-[11px]">Accuracy</div>
                </div>
                <div className="rounded-md border border-[#1c1c1c] p-2">
                    <div
                        className="rounded-md bg-[#1c1c1c]"
                        style={{ aspectRatio: "1 / 1" }}
                    >
                        <div className="h-full w-full px-2 py-3 flex items-center justify-center">
                            <CircleStat
                                label="Profit Accuracy"
                                value={getProfitAccuracy()}
                            />
                        </div>
                    </div>
                    <div className="mt-2 text-center text-[11px]">
                        Profit Accuracy
                    </div>
                </div>
            </div>
        </div>
    );
}

function CircleStat({ label, value, size = 100, stroke = 6 }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, isFinite(value) ? value : 0));
    const dash = (clamped / 100) * circumference;
    const center = size / 2;
    return (
        <div className="flex items-center justify-center">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size}>
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="#222"
                        strokeWidth={stroke}
                        fill="none"
                    />
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="#ffffff"
                        strokeWidth={stroke}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        transform={`rotate(-90 ${center} ${center})`}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[10px] font-semibold">
                        {clamped.toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
    );
}
