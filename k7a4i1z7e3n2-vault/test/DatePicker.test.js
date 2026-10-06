import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import DatePicker from "@/components/k7/DatePicker";

// Tuesday 6 October 2026, midday
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 12));
});
afterEach(() => vi.useRealTimers());

function Harness({ initial = "2026-10-06", onPick = () => {} }) {
    const [day, setDay] = useState(initial);
    return (
        <>
            <label htmlFor="d">Date of trade</label>
            <DatePicker
                id="d"
                value={day}
                max="2026-10-06"
                onChange={(v) => {
                    setDay(v);
                    onPick(v);
                }}
            />
        </>
    );
}

const field = () => screen.getByLabelText("Date of trade");
const open = async () => {
    fireEvent.click(field());
    return screen.findByRole("grid");
};
const key = (k) => act(() => fireEvent.keyDown(document.activeElement, { key: k }));

describe("DatePicker", () => {
    it("writes the day out and says how recent it is", () => {
        render(<Harness initial="2026-10-05" />);
        expect(field().textContent).toContain("Mon, 5 Oct 2026");
        expect(field().textContent).toContain("Yesterday");
    });

    it("opens on the chosen day, Monday first, with the future out of reach", async () => {
        render(<Harness />);
        await open();
        expect(document.activeElement.getAttribute("aria-label")).toBe("Tuesday 6 October 2026, today");
        expect(screen.getAllByRole("gridcell")[0].getAttribute("aria-label")).toBe("Monday 28 September 2026");
        expect(screen.getByRole("gridcell", { name: "Wednesday 7 October 2026" }).disabled).toBe(true);
        expect(screen.getByRole("button", { name: "Next month" }).disabled).toBe(true);
    });

    it("moves by day, week and month from the keyboard, and Enter picks", async () => {
        const onPick = vi.fn();
        render(<Harness onPick={onPick} />);
        await open();
        key("ArrowRight"); // tomorrow is in the future: stays on today
        expect(document.activeElement.getAttribute("aria-label")).toBe("Tuesday 6 October 2026, today");
        key("ArrowUp");
        expect(document.activeElement.getAttribute("aria-label")).toBe("Tuesday 29 September 2026");
        key("PageUp");
        expect(screen.getByText("August")).toBeTruthy();
        expect(document.activeElement.getAttribute("aria-label")).toBe("Saturday 29 August 2026");
        key("End");
        expect(document.activeElement.getAttribute("aria-label")).toBe("Sunday 30 August 2026");
        key("Enter");
        expect(onPick).toHaveBeenCalledWith("2026-08-30");
        expect(screen.queryByRole("grid")).toBeNull();
        expect(field().textContent).toContain("Sun, 30 Aug 2026");
    });

    it("keeps the day when the month is shorter (31 → 30)", async () => {
        render(<Harness initial="2026-08-31" />);
        await open();
        key("PageDown");
        expect(document.activeElement.getAttribute("aria-label")).toBe("Wednesday 30 September 2026");
    });

    it("has today and yesterday a click away", async () => {
        const onPick = vi.fn();
        render(<Harness initial="2026-09-01" onPick={onPick} />);
        await open();
        fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));
        expect(onPick).toHaveBeenCalledWith("2026-10-05");
    });
});
