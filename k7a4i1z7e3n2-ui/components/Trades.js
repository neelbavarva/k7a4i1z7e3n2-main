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
import { Loader2, ClockArrowUp, ClockArrowDown } from "lucide-react";
import { TradeSymbolIconMap } from "./TradeSymbols";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";

export default function Trades() {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tfFilter, setTfFilter] = useState("all"); // all | lower | higher
    const [typeFilter, setTypeFilter] = useState("all"); // all | Real | Funded | Demo | Backtest
    const [pairFilter, setPairFilter] = useState("all"); // all | specific pair
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [viewOpen, setViewOpen] = useState(false);
    const base = process.env.NEXT_PUBLIC_PROD_LINK;
    const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";

    const fetchTrades = () => {
        const baseUrl = (base || "").replace(/\/$/, "");
        const url = `${baseUrl}/trades/getTrades`;
        setLoading(true);
        fetch(url, { headers: { "x-api-key": apiKey } })
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((result) => setTrades(Array.isArray(result) ? result : []))
            .catch(() => setTrades([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const filtered = useMemo(() => {
        return trades
            .filter((t) => {
                if (tfFilter === "lower" && !t.isLowerTf) return false;
                if (tfFilter === "higher" && t.isLowerTf) return false;
                return true;
            })
            .filter((t) => {
                if (typeFilter === "all") return true;
                return String(t.tradeType) === typeFilter;
            })
            .filter((t) => {
                if (pairFilter === "all") return true;
                return String(t.tradeSymbol) === pairFilter;
            });
    }, [trades, tfFilter, typeFilter, pairFilter]);

    const typeClass = (type) => {
        switch (type) {
            case "Demo":
                return "text-[#f4a522]";
            case "Funded":
                return "text-[#7e71f7]";
            case "Backtest":
                return "text-[#fa346f]";
            case "Real":
                return "text-[#4fe3c1]";
            default:
                return "";
        }
    };

    const statusClass = (status) =>
        status === "Open"
            ? "text-[#4fe3c1]"
            : status === "Closed"
            ? "text-[#7e71f7]"
            : "";

    const gradeLabel = (pct) => {
        if (!pct || pct === 0) return "Cntr";
        if (pct >= 90) return "A";
        if (pct >= 80) return "B";
        if (pct >= 70) return "C";
        return "D";
    };

    const gradeColorClass = (pct) => {
        if (!pct || pct === 0) return "text-[#ff0000]";
        if (pct >= 90) return "text-[#4fe3c1]";
        if (pct >= 80) return "text-[#f4a522]";
        if (pct >= 70) return "text-[#ff0000]";
        return "text-[#ff0000]";
    };

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

            {/* Trade Type Filter (similar to category container) + Pair dropdown on right */}
            <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar border border-[#1c1c1c] rounded-[6px] p-1.5 h-10">
                    <button
                        type="button"
                        className={`cursor-pointer px-3 py-1 rounded-[6px] text-[11px] font-medium transition-colors border whitespace-nowrap shrink-0 ${
                            typeFilter === "all"
                                ? "bg-white text-black border-white"
                                : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                        }`}
                        onClick={() => setTypeFilter("all")}
                    >
                        All
                    </button>
                    {["Real", "Funded", "Demo", "Backtest"].map((t) => (
                        <button
                            key={t}
                            type="button"
                            className={`cursor-pointer px-3 py-1 rounded-[6px] text-[11px] font-medium transition-colors border whitespace-nowrap shrink-0 ${
                                typeFilter === t
                                    ? "bg-white text-black border-white"
                                    : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                            }`}
                            onClick={() => setTypeFilter(t)}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="shrink-0">
                    <Select value={pairFilter} onValueChange={setPairFilter}>
                        <SelectTrigger className="h-10 w-[120px] rounded-[6px] text-[11px] bg-zinc-900 border border-[#1c1c1c]">
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
                </div>
            </div>

            {/* Trades Table */}
            <Card className="rounded-md mt-2 p-0">
                {loading ? (
                    <div className="flex items-center justify-center py-10 text-[12px]">
                        <Loader2 className="animate-spin mr-2" /> Loading trades
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto no-scrollbar">
                        <table className="min-w-max w-full">
                            <thead className="text-[10px] font-bold">
                                <tr className="text-[10px] border-b border-[#1c1c1c]">
                                    <th className="text-center py-2 px-3 w-[80px]">
                                        Grade
                                    </th>
                                    <th className="text-center py-2 px-3">
                                        Pair
                                    </th>
                                    <th className="text-center py-2 px-3">
                                        Type
                                    </th>
                                    <th className="text-center py-2 px-3">
                                        Date
                                    </th>
                                    <th className="text-center py-2 px-3">
                                        Risk/Reward
                                    </th>
                                    <th className="text-center py-2 px-3">
                                        P&L (USD)
                                    </th>
                                    <th className="text-center py-2 px-3">
                                        Trade Status
                                    </th>
                                    <th className="text-center py-2 px-3">
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
                                        <td className="py-2 px-3 text-center">
                                            <span
                                                className={`${gradeColorClass(
                                                    t.totalPercentage || 0
                                                )} text-[11px]`}
                                            >
                                                {gradeLabel(
                                                    t.totalPercentage || 0
                                                )}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {TradeSymbolIconMap[
                                                    t.tradeSymbol
                                                ] ? (
                                                    <Image
                                                        width={16}
                                                        height={16}
                                                        src={`/icons/${
                                                            TradeSymbolIconMap[
                                                                t.tradeSymbol
                                                            ]
                                                        }`}
                                                        alt={`${t.tradeSymbol} icon`}
                                                    />
                                                ) : null}
                                                <span>{t.tradeSymbol}</span>
                                            </div>
                                        </td>
                                        <td
                                            className={`py-2 px-3 text-center ${typeClass(
                                                t.tradeType
                                            )}`}
                                        >
                                            {t.tradeType}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {t.dateOfTrade}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {t.riskRewardRatio}
                                        </td>
                                        <td
                                            className={`py-2 px-3 text-center ${
                                                (parseFloat(t.totalPnL) || 0) >=
                                                0
                                                    ? "text-[#4fe3c1]"
                                                    : "text-[#ff0000]"
                                            }`}
                                        >
                                            {t.totalPnL}
                                        </td>
                                        <td
                                            className={`py-2 px-3 text-center ${statusClass(
                                                t.tradeStatus
                                            )}`}
                                        >
                                            {t.tradeStatus}
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="flex items-center justify-center">
                                                {t.isLowerTf ? (
                                                    <ClockArrowDown className="w-3 h-3 text-[#7e71f7]" />
                                                ) : (
                                                    <ClockArrowUp className="w-3 h-3 text-[#4fe3c1]" />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                    <DialogContent className="max-h-[90vh] overflow-y-auto no-scrollbar p-3 sm:p-4 sm:max-w-none sm:w-[560px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <div>{selectedTrade.tradeSymbol}</div>
                            </DialogTitle>
                            <DialogDescription className="text-[12px] pt-1">
                                <span
                                    className={`${gradeColorClass(
                                        selectedTrade.totalPercentage || 0
                                    )}`}
                                >
                                    {gradeLabel(
                                        selectedTrade.totalPercentage || 0
                                    )}
                                </span>
                                <span className="mx-2">,</span>
                                <span
                                    className={`${typeClass(
                                        selectedTrade.tradeType
                                    )}`}
                                >
                                    {selectedTrade.tradeType}
                                </span>
                                <span className="mx-2">,</span>
                                <span
                                    className={`${statusClass(
                                        selectedTrade.tradeStatus
                                    )}`}
                                >
                                    {selectedTrade.tradeStatus}
                                </span>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex items-center flex-wrap gap-x-6 text-[12px] mt-1">
                            <div className="flex items-center">
                                <div>Date</div>
                                <div className="ml-2">
                                    {selectedTrade.dateOfTrade}
                                </div>
                            </div>
                            <div className="flex items-center">
                                <div>Risk Ratio</div>
                                <div className="ml-2">
                                    {selectedTrade.riskRewardRatio}
                                </div>
                            </div>
                            <div className="flex items-center">
                                <div>PnL</div>
                                <div
                                    className={`${
                                        (parseFloat(selectedTrade.totalPnL) ||
                                            0) >= 0
                                            ? "text-[#4fe3c1]"
                                            : "text-[#ff0000]"
                                    } ml-2`}
                                >
                                    {selectedTrade.totalPnL} USD
                                </div>
                            </div>
                        </div>

                        <div className="mt-3">
                            <div className="text-[12px] leading-loose mt-1 mb-1 rounded-md border border-[#1c1c1c] overflow-hidden p-2 space-y-[2px]">
                                {(selectedTrade.responses || []).map((item) => (
                                    <div
                                        key={item.question}
                                        className="text-[12px]"
                                    >
                                        <div className="flex items-center">
                                            <span className="flex-1">
                                                {item.question}
                                            </span>
                                            <span
                                                className={`${
                                                    item.checked
                                                        ? "text-[#4fe3c1]"
                                                        : "text-[#ff0000]"
                                                }`}
                                            >
                                                {item.checked ? "✓" : "✗"}
                                            </span>
                                        </div>
                                        {(item.secondaryResponses || []).map(
                                            (child) => (
                                                <div
                                                    key={
                                                        child._id ||
                                                        child.question
                                                    }
                                                    className="flex items-center ml-5"
                                                >
                                                    <span className="flex-1">
                                                        {child.question}
                                                    </span>
                                                    <span
                                                        className={`${
                                                            child.checked
                                                                ? "text-[#4fe3c1]"
                                                                : "text-[#ff0000]"
                                                        }`}
                                                    >
                                                        {child.checked
                                                            ? "✓"
                                                            : "✗"}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedTrade.description ? (
                            <div className="text-[12px] mt-0 rounded-md border border-[#1c1c1c] overflow-hidden p-2">
                                {selectedTrade.description}
                            </div>
                        ) : null}

                        <div className="mt-0">
                            {selectedTrade.lowTf ? (
                                <div className="rounded-md mt-3 first:mt-1 border border-[#1c1c1c] overflow-hidden">
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
                                <div className="rounded-md mt-3 first:mt-1 border border-[#1c1c1c] overflow-hidden">
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
                                <div className="rounded-md mt-3 first:mt-1 border border-[#1c1c1c] overflow-hidden">
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
