"use client";

import React from "react";

export default function Main({ onLogout }) {
    const last =
        typeof window !== "undefined" ? localStorage.getItem("auth") : null;
    const lastDate = last ? new Date(Number(last)) : null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
            <h1 className="text-2xl mb-2">Main Page</h1>
            {lastDate && (
                <p className="mb-4">Last login: {lastDate.toLocaleString()}</p>
            )}
            <button
                onClick={() => {
                    onLogout();
                }}
                className="px-4 py-2 bg-white text-black rounded"
            >
                Logout
            </button>
        </div>
    );
}
