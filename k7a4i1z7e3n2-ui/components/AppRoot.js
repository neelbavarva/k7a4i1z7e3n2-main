"use client";

import React, { useEffect, useState } from "react";
import Login from "./Login";
import Main from "./Main";

export default function AppRoot() {
    const [isAuthenticated, setIsAuthenticated] = useState(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("auth");
            if (!raw) {
                setIsAuthenticated(false);
                return;
            }
            const ts = Number(raw);
            if (!ts) {
                setIsAuthenticated(false);
                return;
            }
            if (Date.now() - ts < 24 * 60 * 60 * 1000) setIsAuthenticated(true);
            else {
                localStorage.removeItem("auth");
                setIsAuthenticated(false);
            }
        } catch (e) {
            setIsAuthenticated(false);
        }
    }, []);

    if (isAuthenticated === null) return null;

    return isAuthenticated ? (
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
    );
}
