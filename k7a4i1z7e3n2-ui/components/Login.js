"use client";

import React, { useState } from "react";

export default function Login({ onSuccess }) {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    function handleSubmit(e) {
        e.preventDefault();
        if (otp.length !== 6) {
            alert("Enter a 6-digit OTP");
            return;
        }
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            if (otp === "123456") onSuccess();
            else alert("Incorrect OTP");
        }, 400);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <form onSubmit={handleSubmit} className="space-y-4 text-center">
                <h1 className="text-2xl">Sign in</h1>
                <input
                    value={otp}
                    onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    pattern="\d{6}"
                    className="w-40 text-center px-3 py-2 rounded bg-gray-800"
                    placeholder="123456"
                />
                <div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-white text-black rounded"
                    >
                        {loading ? "Checking..." : "Verify"}
                    </button>
                </div>
                <p className="text-sm opacity-70">Demo OTP: 123456</p>
            </form>
        </div>
    );
}
