"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { authenticator } from "otplib";
import { apiPost } from "../lib/api";
import { getCurrentSession, getSessionTiming } from "../lib/session";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import styles from "../css/Login.module.css";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import AuthTimer from "./AuthTimer";
import { Lock } from "lucide-react";
import { s } from "motion/react-client";

export default function Login({ onSuccess }) {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [blockedInfo, setBlockedInfo] = useState(null);
    const [initializing, setInitializing] = useState(true); // NEW
    const inputRef = useRef(null);

    // Initial check: cache + IP/block status
    useEffect(() => {
        (async () => {
            try {
                // 1. Check browser cache (already logged in?)
                const cachedAuth =
                    typeof window !== "undefined"
                        ? localStorage.getItem("auth")
                        : null;

                if (cachedAuth) {
                    onSuccess();
                    return;
                }

                // 2. Check if current IP is blocked
                const r = await apiPost("/isBlocked", {});
                if (r && r.blocked) setBlockedInfo(r);
            } catch (e) {
                console.error("initial auth / isBlocked check failed", e);
            } finally {
                setInitializing(false);
            }
        })();
    }, [onSuccess]);

    const verifyAndSubmit = useCallback(
        async (value) => {
            if (blockedInfo && blockedInfo.blocked) return;
            setLoading(true);

            try {
                const secret = process.env.NEXT_PUBLIC_SECRET_KEY;
                const valid = secret
                    ? authenticator.verify({ token: value, secret })
                    : false;

                if (valid) {
                    try {
                        await apiPost("/reset", {});
                    } catch (e) {
                        console.warn("reset failed", e);
                    }
                    localStorage.setItem("auth", String(Date.now()));
                    onSuccess();
                    return;
                }

                try {
                    const r = await apiPost("/failure", {});
                    if (r && r.blocked) {
                        setBlockedInfo(r);
                    } else {
                        alert("Incorrect OTP");
                        setOtp("");
                        inputRef.current?.focus();
                    }
                } catch (e) {
                    console.error("failure endpoint error", e);
                    alert("Incorrect OTP");
                    setOtp("");
                    inputRef.current?.focus();
                }
            } finally {
                setLoading(false);
            }
        },
        [blockedInfo, onSuccess]
    );

    const handleChange = useCallback(
        (value) => {
            const cleaned = value.replace(/\D/g, "").slice(0, 6);
            setOtp(cleaned);
            if (cleaned.length === 6) {
                verifyAndSubmit(cleaned);
            }
        },
        [verifyAndSubmit]
    );

    useEffect(() => {
        if (otp.length === 6) {
            verifyAndSubmit(otp);
        }
    }, [otp, verifyAndSubmit]);

    if (blockedInfo && blockedInfo.blocked) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-l mb-2">You are blocked</h2>
                    <p className={styles.blockedText}>
                        Blocked until:{" "}
                        {blockedInfo.blockedUntil
                            ? new Date(blockedInfo.blockedUntil).toString()
                            : "unknown"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center ">
            <Card className={styles.loginCard}>
                <div>
                    <Lock width={18} stroke="#313131ff" />
                </div>
                <div className={styles.sessionInfo}>
                    <div>{getCurrentSession()}</div>
                    <div>{getSessionTiming()}</div>
                    <AuthTimer />
                </div>
                <form onSubmit={(e) => e.preventDefault()}>
                    {loading || initializing ? (
                        <div className={styles.otpInputContainer}>
                            <Spinner className={styles.spinner} />
                        </div>
                    ) : (
                        <div
                            className={styles.otpInputContainer}
                            onClick={() => inputRef.current?.focus()}
                        >
                            <InputOTP
                                maxLength={6}
                                value={otp}
                                onChange={handleChange}
                            >
                                <InputOTPGroup>
                                    {[...Array(6)].map((_, index) => (
                                        <InputOTPSlot
                                            key={index}
                                            index={index}
                                        />
                                    ))}
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    )}
                </form>
            </Card>
        </div>
    );
}
