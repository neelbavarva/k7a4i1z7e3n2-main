"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { OTPInput } from "input-otp";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "../lib/api";
import { http } from "../lib/http";
import AuthTimer from "./AuthTimer";
import Mark from "./k7/Mark";
import SessionBar from "./k7/SessionBar";

/** Wrong codes the server allows before it blocks a device for a day (OTP_MAX_FAILED there). */
const TRIES = 3;

export default function Login({ onSuccess }) {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [blockedInfo, setBlockedInfo] = useState(null);
    const [wrong, setWrong] = useState(0);
    const [left, setLeft] = useState(null); // tries left before the server blocks this device
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

    const fail = (info) => {
        // the server counts wrong codes per device: say how many tries are left before the block
        const n = Math.max(0, TRIES - (Number(info?.failedAttempts) || 0));
        setLeft(n);
        toast.error("Wrong code", { description: n === 1 ? "One try left before this device is locked out for a day." : "Check it’s the vault’s entry in your authenticator app." });
        setOtp("");
        setWrong((n) => n + 1);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const verifyAndSubmit = useCallback(
        async (value) => {
            if (blockedInfo?.blocked || loading) return;
            setLoading(true);
            try {
                // the server checks the code and hands back the day's session
                const r = await http("/otp/unlock", { method: "POST", body: { code: value } });
                onSuccess(r.session);
            } catch (e) {
                // only the server can open the vault: a code it couldn't check doesn't count either way
                if (e.info?.blocked) setBlockedInfo(e.info);
                else if (e.status === 401 && e.info?.code === "wrong") fail(e.info);
                else {
                    setOtp("");
                    toast.error("Couldn’t check the code", { description: "The server may be waking up. Wait a few seconds and type a fresh code." });
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

                <p className={`lock-foot${left != null && left <= 1 ? " is-warn" : ""}`} aria-live="polite">
                    {busy ? (
                        <>{initializing ? "Checking this device…" : "Checking code…"}</>
                    ) : left != null ? (
                        <>
                            Wrong code · {left === 1 ? "1 try" : `${left} tries`} left before a day’s lockout
                        </>
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
