"use client";
import { useState, useEffect } from "react";
import styles from "../css/Login.module.css";

export default function AuthTimer({ target = "2027-02-01T00:00:00" }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const targetDate = new Date(target);

        const update = () => {
            const now = new Date();
            const diff = targetDate - now;
            if (diff <= 0) {
                setTimeLeft("Time’s up!");
                return;
            }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor(
                (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
            );
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            const milliseconds = Math.floor((diff % 1000) / 10);

            setTimeLeft(
                `${days}d ${hours}h ${minutes}m ${seconds}s ${milliseconds
                    .toString()
                    .padStart(2, "0")}ms`
            );
        };

        update();
        const timer = setInterval(update, 100);
        return () => clearInterval(timer);
    }, [target]);

    return <div className={styles.timer}>{timeLeft}</div>;
}
