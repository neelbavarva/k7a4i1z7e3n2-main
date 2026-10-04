"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { authenticator } from "otplib";
import { OTPInput } from "input-otp";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "../lib/api";
import AuthTimer from "./AuthTimer";
import Mark from "./k7/Mark";
import SessionBar from "./k7/SessionBar";

export default function Login({ onSuccess }) {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [blockedInfo, setBlockedInfo] = useState(null);
    const [wrong, setWrong] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        document.title = "Locked · k7a4i1z7e3n2";
    }, []);

    // Is this device blocked after too many wrong codes?
    useEffect(() => {
        (async () => {
            try {
                const r = await apiPost("/isBlocked", {});
                if (r && r.blocked) setBlockedInfo(r);
            } catch (e) {
                console.error("isBlocked check failed", e);
            } finally {
                setInitializing(false);
            }
        })();
    }, []);

    const fail = () => {
        toast.error("Incorrect code", { description: "Check the code and try again." });
        setOtp("");
        setWrong((n) => n + 1);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const verifyAndSubmit = useCallback(
        async (value) => {
            if (blockedInfo?.blocked || loading) return;
            setLoading(true);
            try {
                const secret = process.env.NEXT_PUBLIC_SECRET_KEY;
                const valid = secret ? authenticator.verify({ token: value, secret }) : false;
                if (valid) {
                    try {
                        await apiPost("/reset", {});
                    } catch (e) {
                        console.warn("reset failed", e);
                    }
                    onSuccess();
                    return;
                }
                try {
                    const r = await apiPost("/failure", {});
                    if (r && r.blocked) setBlockedInfo(r);
                    else fail();
                } catch (e) {
                    console.error("failure endpoint error", e);
                    fail();
                }
            } finally {
                setLoading(false);
            }
        },
        [blockedInfo, onSuccess, loading]
    );

    const handleChange = (value) => {
        const cleaned = value.replace(/\D/g, "").slice(0, 6);
        setOtp(cleaned);
        if (cleaned.length === 6) verifyAndSubmit(cleaned);
    };

    if (blockedInfo?.blocked) {
        const until = blockedInfo.blockedUntil ? new Date(blockedInfo.blockedUntil) : null;
        return (
            <div className="page">
                <main className="state fade-in" role="alert">
                    <p className="state-code">Blocked</p>
                    <h1 className="state-title">Too many wrong codes</h1>
                    <p className="state-text">
                        This device is locked out
                        {until
                            ? ` until ${until.toLocaleString(undefined, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  hour: "numeric",
                                  minute: "2-digit",
                              })}.`
                            : " for now."}{" "}
                        Try again after that.
                    </p>
                </main>
            </div>
        );
    }

    const busy = loading || initializing;

    return (
        <main className="lock">
            <div className="lock-in fade-in">
                <Mark />
                <h1 className="lock-title">Locked</h1>
                <p className="lock-text">Enter the 6-digit code from your authenticator app to open your vault and journal.</p>

                <form onSubmit={(e) => e.preventDefault()}>
                    <OTPInput
                        key={wrong}
                        ref={inputRef}
                        maxLength={6}
                        value={otp}
                        onChange={handleChange}
                        disabled={busy}
                        autoFocus
                        inputMode="numeric"
                        aria-label="Authenticator code"
                        containerClassName={`otp${busy ? " is-busy" : ""}${wrong ? " is-wrong" : ""}`}
                        render={({ slots }) =>
                            slots.map((slot, i) => (
                                <div key={i} className={`otp-slot${slot.isActive && !busy ? " is-active" : ""}`}>
                                    {slot.char ? <span>{slot.char}</span> : slot.hasFakeCaret && !busy ? <i className="otp-caret" /> : null}
                                </div>
                            ))
                        }
                    />
                </form>

                <p className="lock-foot" aria-live="polite">
                    {busy ? (
                        <>{initializing ? "Checking this device…" : "Checking code…"}</>
                    ) : (
                        <>
                            <Hourglass aria-hidden="true" />
                            <AuthTimer />
                        </>
                    )}
                </p>
                <SessionBar />
            </div>
        </main>
    );
}
