"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { Check, X } from "lucide-react";
import Login from "./Login";
import Main from "./Main";
import { UNLOCK_MS, lock, subscribe, unlock, unlockedAt } from "@/lib/auth";

function Toasts() {
    return (
        <Toaster
            position="top-center"
            gap={8}
            icons={{ success: <Check />, error: <X /> }}
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast: "toast",
                    title: "toast-title",
                    description: "toast-desc",
                    success: "toast-success",
                    error: "toast-error",
                },
            }}
        />
    );
}

export default function AppRoot() {
    // when this browser was unlocked (0: locked); null while rendering on the server
    const since = useSyncExternalStore(subscribe, unlockedAt, () => null);

    // an unlock lasts a day, even with the tab left open
    useEffect(() => {
        if (!since) return;
        const id = setTimeout(lock, Math.max(0, since + UNLOCK_MS - Date.now()));
        return () => clearTimeout(id);
    }, [since]);

    if (since === null) return null;

    return (
        <>
            <Toasts />
            {since ? <Main unlockedAt={since} onLogout={lock} /> : <Login onSuccess={() => unlock()} />}
        </>
    );
}
