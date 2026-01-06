"use client";
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Minus, Plus } from "lucide-react";
import TradeSymbols from "./TradeSymbols";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
// Icons intentionally omitted per request; text-only select.
import Image from "next/image";

export default function AddTrade({ inline = false }) {
    const [strategy, setStrategy] = useState(null);
    const [secondaryStrategy, setSecondaryStrategy] = useState(null);
    const [selected, setSelected] = useState({});
    const [totalPercentage, setTotalPercentage] = useState(0);
    const [loading, setLoading] = useState(false);

    const [tradeSymbol, setTradeSymbol] = useState("");
    const [tradeType, setTradeType] = useState("");
    const [dateOfTrade, setDateOfTrade] = useState(
        new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        })
    );
    const [riskRewardRatio, setRiskRewardRatio] = useState("");
    const [tradeStatus, setTradeStatus] = useState("");
    const [totalPnL, setTotalPnL] = useState("");
    const [description, setDescription] = useState("");
    const [counterTrade, setCounterTrade] = useState(false);
    const [timeFrame, setTimeFrame] = useState("lower");
    const [lowTf, setLowTf] = useState("");
    const [highTf, setHighTf] = useState("");
    const [midTf, setMidTf] = useState("");

    const base = process.env.NEXT_PUBLIC_PROD_LINK;
    const apiKey = process.env.NEXT_PUBLIC_SERVER_KEY || "";

    const fetchStrategy = () => {
        fetch(`${base}/trades/getStrategyPoints`, {
            method: "GET",
            headers: { "x-api-key": apiKey },
        })
            .then((res) => res.json())
            .then((result) => setStrategy(result))
            .catch(() => setStrategy("network_error"));
    };

    const fetchSecondaryStrategy = () => {
        fetch(`${base}/trades/getStrategySecondaryPoints`, {
            method: "GET",
            headers: { "x-api-key": apiKey },
        })
            .then((res) => res.json())
            .then((result) => setSecondaryStrategy(result))
            .catch(() => setSecondaryStrategy("network_error"));
    };

    const addNewTrade = () => {
        setLoading(true);
        const points = timeFrame === "lower" ? secondaryStrategy : strategy;
        const responses = [];

        (Array.isArray(points) ? points : []).forEach((item) => {
            const responseItem = {
                question: item.name,
                checked: !!selected[item._id],
                secondaryResponses: [],
            };
            if (Array.isArray(item.secondaryStrategyPoints)) {
                item.secondaryStrategyPoints.forEach((child) => {
                    responseItem.secondaryResponses.push({
                        question: child.name,
                        checked: !!selected[child._id],
                        _id: child._id,
                    });
                });
            }
            responses.push(responseItem);
        });

        const payload = {
            responses,
            riskRewardRatio,
            tradeType,
            dateOfTrade,
            tradeSymbol,
            tradeStatus,
            totalPercentage,
            totalPnL: parseFloat(totalPnL) || 0,
            description,
            isLowerTf: timeFrame === "lower",
            lowTf,
            midTf,
            highTf,
        };

        fetch(`${base}/trades/newTrade`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify(payload),
        })
            .then((res) => res.json())
            .then(() => window.location.reload())
            .catch((error) => console.error("Error in POST trade:", error))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchStrategy();
        fetchSecondaryStrategy();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCheckboxChange = (id, percentage) => {
        setSelected((prev) => {
            const points = timeFrame === "lower" ? secondaryStrategy : strategy;
            const nextSel = { ...prev, [id]: !prev[id] };
            let total = 0;

            (Array.isArray(points) ? points : []).forEach((item) => {
                if (item._id === id && !prev[id]) {
                    (item.secondaryStrategyPoints || []).forEach((child) => {
                        delete nextSel[child._id];
                    });
                } else if (
                    (item.secondaryStrategyPoints || []).some(
                        (child) => child._id === id
                    )
                ) {
                    const allChildrenSelected = (
                        item.secondaryStrategyPoints || []
                    ).every((child) => nextSel[child._id]);
                    if (allChildrenSelected) {
                        (item.secondaryStrategyPoints || []).forEach(
                            (child) => {
                                delete nextSel[child._id];
                            }
                        );
                        nextSel[item._id] = true;
                    } else {
                        delete nextSel[item._id];
                    }
                }
                if (nextSel[item._id]) total += item.percentage;
                (item.secondaryStrategyPoints || []).forEach((child) => {
                    if (nextSel[child._id]) total += child.percentage;
                });
            });

            setTotalPercentage(total);
            return nextSel;
        });
    };

    const getTradeGrade = () => {
        if (totalPercentage >= 90) return "A";
        if (totalPercentage >= 80) return "B";
        if (totalPercentage >= 70) return "C";
        return "D";
    };

    const renderStrategyPoints = () => (
        <div className="space-y-2">
            <Card className="w-full flex flex-row items-center px-2 py-2">
                <div className="text-[12px]">Counter Trade</div>
                <button
                    type="button"
                    onClick={() => setCounterTrade(!counterTrade)}
                    className={`ml-auto relative inline-flex h-5 w-9 items-center justify-start rounded-full transition-colors focus-visible:outline-none border cursor-pointer ${
                        counterTrade 
                            ? "bg-[#ff0000] border-[#ff0000]" 
                            : "bg-black border-[#1c1c1c]"
                    }`}
                >
                    <span
                        className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                            counterTrade ? "translate-x-5" : "translate-x-1"
                        }`}
                    />
                </button>
            </Card>
            <Card className="w-full flex flex-row items-center gap-1 px-1 py-1">
                <Button
                    onClick={() => setTimeFrame("lower")}
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-[10px] flex-1 justify-center border-none cursor-pointer ${
                        timeFrame === "lower" ? "bg-[#1c1c1c]" : ""
                    }`}
                >
                    Lower Time Frame
                </Button>
                <Button
                    onClick={() => setTimeFrame("higher")}
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-[10px] flex-1 justify-center border-none cursor-pointer ${
                        timeFrame === "higher" ? "bg-[#1c1c1c]" : ""
                    }`}
                >
                    Higher Time Frame
                </Button>
            </Card>
            {counterTrade ? null : (
                <div className="space-y-1">
                    <Card className="w-full flex flex-row items-center px-4 py-2">
                        <div
                            className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-[12px] ${
                                getTradeGrade() === "A"
                                    ? "text-[#4fe3c1] bg-[#4fe3c023]"
                                    : getTradeGrade() === "B"
                                    ? "text-[#f4a522] bg-[#f4a32224]"
                                    : "text-[#ff5050] bg-[#ff003721]"
                            }`}
                        >
                            {getTradeGrade()}
                        </div>
                        <div className="text-[12px] ml-auto">
                            {totalPercentage} %
                        </div>
                    </Card>
                    <Card className="px-3 py-2 pt-7 rounded-md">
                        {(Array.isArray(
                            timeFrame === "lower" ? secondaryStrategy : strategy
                        )
                            ? timeFrame === "lower"
                                ? secondaryStrategy
                                : strategy
                            : []
                        ).map((item) => (
                            <div
                                className="flex flex-col mt-1 -mb-1"
                                key={item._id}
                            >
                                <div className="flex items-center -mt-5 text-[10px] leading-[16px] gap-2">
                                    <div className="pr-3 sm:pr-4">
                                        {item.name}
                                    </div>
                                    <span className="h-[1px] bg-[#1c1c1c] flex-1" />
                                    <div className="flex items-center gap-2">
                                        <div className="text-[10px]">
                                            {item.percentage}%
                                        </div>
                                        <Checkbox
                                            checked={
                                                selected[item._id] || false
                                            }
                                            onCheckedChange={() =>
                                                handleCheckboxChange(
                                                    item._id,
                                                    item.percentage
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                                {!selected[item._id] &&
                                    Array.isArray(
                                        item.secondaryStrategyPoints
                                    ) &&
                                    item.secondaryStrategyPoints.length > 0 && (
                                        <div className="flex flex-col mt-[2px]">
                                            {item.secondaryStrategyPoints.map(
                                                (child) => (
                                                    <div
                                                        className="flex items-center mt-[2px] gap-2"
                                                        key={child._id}
                                                    >
                                                        <div className="flex items-center justify-start gap-2 pr-3 sm:pr-4">
                                                            <Minus color="rgba(85,85,85)" />
                                                            <div className="text-[10px]">
                                                                {child.name}
                                                            </div>
                                                        </div>
                                                        <span className="h-[1px] bg-[#1c1c1c] flex-1" />
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-[10px]">
                                                                {
                                                                    child.percentage
                                                                }
                                                                %
                                                            </div>
                                                            <Checkbox
                                                                checked={
                                                                    selected[
                                                                        child
                                                                            ._id
                                                                    ] || false
                                                                }
                                                                onCheckedChange={() =>
                                                                    handleCheckboxChange(
                                                                        child._id,
                                                                        child.percentage
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                            </div>
                        ))}
                    </Card>
                </div>
            )}
            <div className="mt-1">
                <Label className="text-[12px]">Trade Symbol</Label>
                <Select onValueChange={setTradeSymbol} value={tradeSymbol}>
                    <SelectTrigger className="h-8 text-xs cursor-pointer w-full">
                        <SelectValue placeholder="Select Pair" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {TradeSymbols.map((symbol) => (
                                <SelectItem
                                    key={symbol.symbol}
                                    value={symbol.symbol}
                                    className="text-xs cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <Image
                                            width={16}
                                            height={16}
                                            src={`/icons/${symbol.img}`}
                                            alt={`${symbol.symbol} icon`}
                                        />
                                        <span>{symbol.symbol}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="mt-1">
                <Label className="text-[12px]">Risk Ratio</Label>
                <Input
                    className="text-[12px]"
                    value={riskRewardRatio}
                    onChange={(e) => setRiskRewardRatio(e.target.value)}
                />
            </div>
            <div className="mt-1">
                <Label className="text-[12px]">Trade Type</Label>
                <Select value={tradeType} onValueChange={setTradeType}>
                    <SelectTrigger className="h-8 text-xs cursor-pointer w-full">
                        <SelectValue placeholder="Real / Demo / Funded / Backtest" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {["Real", "Demo", "Funded", "Backtest"].map((t) => (
                                <SelectItem
                                    value={t}
                                    key={t}
                                    className="text-xs cursor-pointer"
                                >
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="mt-1">
                <Label className="text-[12px]">Date of Trade</Label>
                <Input
                    className="text-[12px]"
                    placeholder="25 June 2025"
                    value={dateOfTrade}
                    onChange={(e) => setDateOfTrade(e.target.value)}
                />
            </div>
            <div className="mt-1">
                <Label className="text-[12px]">Trade Status</Label>
                <Select value={tradeStatus} onValueChange={setTradeStatus}>
                    <SelectTrigger className="h-8 text-xs cursor-pointer w-full">
                        <SelectValue placeholder="Open / Closed" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {["Open", "Closed"].map((t) => (
                                <SelectItem
                                    value={t}
                                    key={t}
                                    className="text-xs cursor-pointer"
                                >
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="mt-1">
                <Label className="text-[12px]">Total PnL</Label>
                <Input
                    className="text-[12px]"
                    value={totalPnL}
                    onChange={(e) => setTotalPnL(e.target.value)}
                />
            </div>
            {tradeStatus === "Closed" ? (
                <div className="space-y-1">
                    <div>
                        <Label className="text-[12px]">
                            {timeFrame === "lower" ? "15min" : "4H"}
                        </Label>
                        <Input
                            className="text-[12px]"
                            placeholder="https://s3.tradingview.com/snapshots/X/XXXXXXXX.png"
                            value={lowTf}
                            onChange={(e) => setLowTf(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="text-[12px]">
                            {timeFrame === "lower" ? "1H" : "1D"}
                        </Label>
                        <Input
                            className="text-[12px]"
                            placeholder="https://s3.tradingview.com/snapshots/X/XXXXXXXX.png"
                            value={midTf}
                            onChange={(e) => setMidTf(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="text-[12px]">
                            {timeFrame === "lower" ? "4H" : "W"}
                        </Label>
                        <Input
                            className="text-[12px]"
                            placeholder="https://s3.tradingview.com/snapshots/X/XXXXXXXX.png"
                            value={highTf}
                            onChange={(e) => setHighTf(e.target.value)}
                        />
                    </div>
                </div>
            ) : null}
            <div className="mt-1">
                <Label className="text-[12px]">Description</Label>
                <Textarea
                    className="text-[12px]"
                    placeholder="Add your description to Trade"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>
            <div className="mt-3">
                <Button
                    onClick={addNewTrade}
                    disabled={loading}
                    className="w-full cursor-pointer"
                >
                    Submit{" "}
                    {loading && <Loader2 className="animate-spin ml-2" />}
                </Button>
            </div>
        </div>
    );

    if (inline) {
        return (
            <div>
                {strategy == null || secondaryStrategy == null
                    ? null
                    : renderStrategyPoints()}
            </div>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    className="border-none bg-transparent hover:bg-transparent cursor-pointer"
                    variant="outline"
                    size="sm"
                >
                    <Plus />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto no-scrollbar p-3 sm:p-4">
                <DialogHeader>
                    <DialogTitle className="text-[14px] font-semibold tracking-wide">
                        Add New Trade
                    </DialogTitle>
                    <DialogDescription className="text-[12px] text-muted-foreground">
                        Choose your Trades wisely
                    </DialogDescription>
                </DialogHeader>
                <div>
                    {strategy == null || secondaryStrategy == null
                        ? null
                        : renderStrategyPoints()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
