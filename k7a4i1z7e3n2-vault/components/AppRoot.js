"use client";

import React, { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Check, X } from "lucide-react";
import Login from "./Login";
import Main from "./Main";

const DAY = 24 * 60 * 60 * 1000;

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
    const [isAuthenticated, setIsAuthenticated] = useState(null);

    useEffect(() => {
        try {
            const ts = Number(localStorage.getItem("auth"));
            if (ts && Date.now() - ts < DAY) setIsAuthenticated(true);
            else {
                localStorage.removeItem("auth");
                setIsAuthenticated(false);
            }
        } catch {
            setIsAuthenticated(false);
        }
    }, []);

    if (isAuthenticated === null) return null;

    return (
        <>
            <Toasts />
            {isAuthenticated ? (
                <Main
                    onLogout={() => {
                        localStorage.removeItem("auth");
                        setIsAuthenticated(false);
                    }}
                />
            ) : (
                <Login
                    onSuccess={() => {
                        localStorage.setItem("auth", String(Date.now()));
                        setIsAuthenticated(true);
                    }}
                />
            )}
        </>
    );
}
