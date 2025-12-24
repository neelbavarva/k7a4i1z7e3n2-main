"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import TradeSymbols from "./TradeSymbols";
import Image from "next/image";
import { Eye, Loader2 } from "lucide-react";

export default function Trades() {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tfFilter, setTfFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("All");
    const [pairFilter, setPairFilter] = useState("ALL");
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [closeDialog, setCloseDialog] = useState({
        open: false,
        trade: null,
    });
    const [closeForm, setCloseForm] = useState({
        pnl: "",
        lowTf: "",
        midTf: "",
        highTf: "",
        description: "",
    });
    const base = process.env.NEXT_PUBLIC_PROD_LINK;
    const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";

    const fetchTrades = () => {
        setLoading(true);
        fetch(`${base}/trades/getTrades`, { headers: { "x-api-key": apiKey } })
            .then((res) => res.json())
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
            if (typeFilter !== "All" && t.tradeType !== typeFilter)
                return false;
            if (
                pairFilter &&
                pairFilter !== "ALL" &&
                t.tradeSymbol !== pairFilter
            )
                return false;
            return true;
        });
    }, [trades, tfFilter, typeFilter, pairFilter]);

    const accuracy = useMemo(() => {
        const closed = filtered.filter((t) => t.tradeStatus === "Closed");
        if (closed.length === 0) return 0;
        const wins = closed.filter(
            (t) => (parseFloat(t.totalPnL) || 0) > 0
        ).length;
        return Math.round((wins / closed.length) * 100);
    }, [filtered]);

    const avgRR = useMemo(() => {
        const rr = filtered
            .map((t) => parseFloat(t.riskRewardRatio) || 0)
            .filter((n) => n > 0);
        if (!rr.length) return 0;
        const sum = rr.reduce((a, b) => a + b, 0);
        return (sum / rr.length).toFixed(2);
    }, [filtered]);

    const totalPnL = useMemo(() => {
        const pnl = filtered.map((t) => parseFloat(t.totalPnL) || 0);
        const sum = pnl.reduce((a, b) => a + b, 0);
        return sum.toFixed(2);
    }, [filtered]);

    const gradeFor = (pct) => {
        if (pct >= 90) return "A";
        if (pct >= 80) return "B";
        if (pct >= 70) return "C";
        return "D";
    };

    const typeClass = (type) => {
        if (type === "Real") return "text-[#4fe3c1]";
        if (type === "Demo") return "text-[#f4a522]";
        if (type === "Funded") return "text-[#7e71f7]";
        if (type === "Backtest") return "text-[#fa346f]";
        return "";
    };

    const statusClass = (status) => {
        if (status === "Open") return "text-[#4fe3c1]";
        if (status === "Closed") return "text-[#7e71f7]";
        return "";
    };

    const openCloseDialog = (trade) => {
        setCloseForm({
            pnl: trade?.totalPnL ? String(trade.totalPnL) : "",
            lowTf: trade?.lowTf || "",
            midTf: trade?.midTf || "",
            highTf: trade?.highTf || "",
            description: trade?.description || "",
        });
        setCloseDialog({ open: true, trade });
    };

    const submitCloseTrade = () => {
        const id = closeDialog.trade?._id;
        if (!id) return;
        const payload = {
            tradeStatus: "Closed",
            totalPnL: parseFloat(closeForm.pnl) || 0,
            lowTf: closeForm.lowTf,
            midTf: closeForm.midTf,
            highTf: closeForm.highTf,
            description: closeForm.description,
        };
        setLoading(true);
        fetch(`${base}/trades/updateTrade/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify(payload),
        })
            .then((res) => res.json())
            .then(() => {
                setCloseDialog({ open: false, trade: null });
                fetchTrades();
            })
            .catch(() => setCloseDialog({ open: false, trade: null }))
            .finally(() => setLoading(false));
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold">Trades</h2>
            </div>

            <Card className="flex items-center px-4 py-2 text-[12px]">
                <div>
                    <Button
                        variant={tfFilter === "all" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTfFilter("all")}
                    >
                        All TF
                    </Button>
                    <Button
                        variant={tfFilter === "lower" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTfFilter("lower")}
                    >
                        Lower TF
                    </Button>
                    <Button
                        variant={tfFilter === "higher" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTfFilter("higher")}
                    >
                        Higher TF
                    </Button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="text-[10px]">Accuracy: {accuracy}%</div>
                    <div className="text-[10px]">Avg RR: {avgRR}</div>
                    <div className="text-[10px]">PnL: {totalPnL}</div>
                </div>
            </Card>

            <Card className="flex items-center px-2 py-2">
                <div className="flex items-center gap-1 overflow-auto whitespace-nowrap flex-1">
                    <Button
                        variant={typeFilter === "All" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTypeFilter("All")}
                    >
                        All
                    </Button>
                    {["Real", "Demo", "Funded", "Backtest"].map((t) => (
                        <Button
                            key={t}
                            variant={typeFilter === t ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setTypeFilter(t)}
                        >
                            {t}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center justify-end">
                    <span className="text-[10px] mr-2">Pair</span>
                    <Select value={pairFilter} onValueChange={setPairFilter}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="ALL">All</SelectItem>
                                {TradeSymbols.map((s) => (
                                    <SelectItem key={s.symbol} value={s.symbol}>
                                        {s.symbol}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            <Card className="rounded-md mt-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center mt-16">
                        <div className="mb-3 text-[12px]">Loading trades…</div>
                        <Loader2 className="animate-spin" />
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="text-[10px] font-bold">
                            <tr className="text-[10px]">
                                <th className="text-left">#</th>
                                <th className="text-left">Pair</th>
                                <th className="text-left">Type</th>
                                <th className="text-left">Status</th>
                                <th className="text-left">RR</th>
                                <th className="text-left">PnL</th>
                                <th className="text-left">Grade</th>
                                <th className="text-left">%</th>
                                <th className="text-left">Date</th>
                                <th className="text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t, idx) => (
                                <tr key={t._id} className="text-[11px]">
                                    <td className="py-2">{idx + 1}</td>
                                    <td className="py-2">
                                        <div className="flex min-w-[3rem]">
                                            <div className="ml-2">
                                                {t.tradeSymbol}
                                            </div>
                                        </div>
                                    </td>
                                    <td
                                        className={`${typeClass(
                                            t.tradeType
                                        )} py-2`}
                                    >
                                        {t.tradeType}
                                    </td>
                                    <td
                                        className={`${statusClass(
                                            t.tradeStatus
                                        )} py-2`}
                                    >
                                        {t.tradeStatus}
                                    </td>
                                    <td className="py-2">
                                        {t.riskRewardRatio}
                                    </td>
                                    <td
                                        className={`${
                                            (parseFloat(t.totalPnL) || 0) >= 0
                                                ? "text-[#4fe3c1]"
                                                : "text-[#ff5050]"
                                        } py-2`}
                                    >
                                        {t.totalPnL}
                                    </td>
                                    <td
                                        className={`${
                                            (t.totalPercentage || 0) >= 80
                                                ? "text-[#4fe3c1]"
                                                : (t.totalPercentage || 0) >= 70
                                                ? "text-[#f4a522]"
                                                : "text-[#ff5050]"
                                        } py-2`}
                                    >
                                        {gradeFor(t.totalPercentage || 0)}
                                    </td>
                                    <td className="py-2">
                                        {t.totalPercentage || 0}%
                                    </td>
                                    <td className="py-2">{t.dateOfTrade}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setSelectedTrade(t)
                                                        }
                                                    >
                                                        <Eye />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-h-[90vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center">
                                                            <div>
                                                                {t.tradeSymbol}
                                                            </div>
                                                            <div className="ml-2 text-[10px]">
                                                                <Card
                                                                    className={`${typeClass(
                                                                        t.tradeType
                                                                    )} px-2 py-1`}
                                                                >
                                                                    {
                                                                        t.tradeType
                                                                    }
                                                                </Card>
                                                            </div>
                                                        </DialogTitle>
                                                        <DialogDescription className="flex pt-2">
                                                            <div className="mr-2">
                                                                <Card
                                                                    className={`${
                                                                        t.tradeStatus ===
                                                                        "Open"
                                                                            ? "text-[#4fe3c1] bg-[#4fe3c023]"
                                                                            : "text-[#7e71f7] bg-[#7e71f744]"
                                                                    } text-[11px] px-2 py-1`}
                                                                >
                                                                    {
                                                                        t.tradeStatus
                                                                    }
                                                                </Card>
                                                            </div>
                                                            <div>
                                                                <Card
                                                                    className={`${
                                                                        (t.totalPercentage ||
                                                                            0) >=
                                                                        80
                                                                            ? "text-[#4fe3c1] bg-[#4fe3c023]"
                                                                            : (t.totalPercentage ||
                                                                                  0) >=
                                                                              70
                                                                            ? "text-[#f4a522] bg-[#f4a32224]"
                                                                            : "text-[#ff5050] bg-[#ff003721]"
                                                                    } text-[11px] px-2 py-1`}
                                                                >
                                                                    {gradeFor(
                                                                        t.totalPercentage ||
                                                                            0
                                                                    )}
                                                                </Card>
                                                            </div>
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="flex items-center">
                                                        <div className="flex items-center text-[12px] mr-4">
                                                            <div>RR</div>
                                                            <div className="ml-2">
                                                                {
                                                                    t.riskRewardRatio
                                                                }
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center text-[12px] mr-4">
                                                            <div>PnL</div>
                                                            <div
                                                                className={`${
                                                                    (parseFloat(
                                                                        t.totalPnL
                                                                    ) || 0) >= 0
                                                                        ? "text-[#4fe3c1]"
                                                                        : "text-[#ff5050]"
                                                                } ml-2`}
                                                            >
                                                                {t.totalPnL}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center text-[12px]">
                                                            <div>Points</div>
                                                            <div className="ml-2">
                                                                {t.totalPercentage ||
                                                                    0}
                                                                %
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {t.description ? (
                                                        <div className="text-[12px] pb-2.5">
                                                            {t.description}
                                                        </div>
                                                    ) : null}
                                                    <div className="-mt-4">
                                                        {t.lowTf ? (
                                                            <div className="rounded-md mt-4">
                                                                <div className="px-4 py-2 text-[12px] font-semibold">
                                                                    {t.isLowerTf
                                                                        ? "15min"
                                                                        : "4H"}
                                                                </div>
                                                                <Image
                                                                    className="rounded-b-md"
                                                                    src={
                                                                        t.lowTf
                                                                    }
                                                                    alt="chart"
                                                                    width={900}
                                                                    height={500}
                                                                />
                                                            </div>
                                                        ) : null}
                                                        {t.midTf ? (
                                                            <div className="rounded-md mt-4">
                                                                <div className="px-4 py-2 text-[12px] font-semibold">
                                                                    {t.isLowerTf
                                                                        ? "1H"
                                                                        : "1D"}
                                                                </div>
                                                                <Image
                                                                    className="rounded-b-md"
                                                                    src={
                                                                        t.midTf
                                                                    }
                                                                    alt="chart"
                                                                    width={900}
                                                                    height={500}
                                                                />
                                                            </div>
                                                        ) : null}
                                                        {t.highTf ? (
                                                            <div className="rounded-md mt-4">
                                                                <div className="px-4 py-2 text-[12px] font-semibold">
                                                                    {t.isLowerTf
                                                                        ? "4H"
                                                                        : "W"}
                                                                </div>
                                                                <Image
                                                                    className="rounded-b-md"
                                                                    src={
                                                                        t.highTf
                                                                    }
                                                                    alt="chart"
                                                                    width={900}
                                                                    height={500}
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>

                                            {t.tradeStatus === "Open" ? (
                                                <Dialog
                                                    open={
                                                        closeDialog.open &&
                                                        closeDialog.trade
                                                            ?._id === t._id
                                                    }
                                                    onOpenChange={(o) =>
                                                        setCloseDialog({
                                                            open: o,
                                                            trade: o ? t : null,
                                                        })
                                                    }
                                                >
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() =>
                                                                openCloseDialog(
                                                                    t
                                                                )
                                                            }
                                                        >
                                                            Close
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle className="text-[16px]">
                                                                Close Trade
                                                            </DialogTitle>
                                                        </DialogHeader>
                                                        <div className="mt-1">
                                                            <Label className="text-[12px]">
                                                                Total PnL
                                                            </Label>
                                                            <Input
                                                                className="text-[12px]"
                                                                value={
                                                                    closeForm.pnl
                                                                }
                                                                onChange={(e) =>
                                                                    setCloseForm(
                                                                        {
                                                                            ...closeForm,
                                                                            pnl: e
                                                                                .target
                                                                                .value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="mt-1">
                                                            <Label className="text-[12px]">
                                                                {t.isLowerTf
                                                                    ? "15min"
                                                                    : "4H"}
                                                            </Label>
                                                            <Input
                                                                className="text-[12px]"
                                                                value={
                                                                    closeForm.lowTf
                                                                }
                                                                onChange={(e) =>
                                                                    setCloseForm(
                                                                        {
                                                                            ...closeForm,
                                                                            lowTf: e
                                                                                .target
                                                                                .value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="mt-1">
                                                            <Label className="text-[12px]">
                                                                {t.isLowerTf
                                                                    ? "1H"
                                                                    : "1D"}
                                                            </Label>
                                                            <Input
                                                                className="text-[12px]"
                                                                value={
                                                                    closeForm.midTf
                                                                }
                                                                onChange={(e) =>
                                                                    setCloseForm(
                                                                        {
                                                                            ...closeForm,
                                                                            midTf: e
                                                                                .target
                                                                                .value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="mt-1">
                                                            <Label className="text-[12px]">
                                                                {t.isLowerTf
                                                                    ? "4H"
                                                                    : "W"}
                                                            </Label>
                                                            <Input
                                                                className="text-[12px]"
                                                                value={
                                                                    closeForm.highTf
                                                                }
                                                                onChange={(e) =>
                                                                    setCloseForm(
                                                                        {
                                                                            ...closeForm,
                                                                            highTf: e
                                                                                .target
                                                                                .value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="mt-1">
                                                            <Label className="text-[12px]">
                                                                Description
                                                            </Label>
                                                            <Input
                                                                className="text-[12px]"
                                                                value={
                                                                    closeForm.description
                                                                }
                                                                onChange={(e) =>
                                                                    setCloseForm(
                                                                        {
                                                                            ...closeForm,
                                                                            description:
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="mt-3">
                                                            <Button
                                                                onClick={
                                                                    submitCloseTrade
                                                                }
                                                                disabled={
                                                                    loading
                                                                }
                                                                className="w-full"
                                                            >
                                                                Submit{" "}
                                                                {loading && (
                                                                    <Loader2 className="animate-spin ml-2" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
