import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useKey } from "@/components/k7/hooks";

function Keyed({ onKey }) {
    useKey("n", onKey);
    return <input aria-label="field" />;
}

describe("single-key shortcuts", () => {
    it("run on their key, in either case, and not with a modifier", () => {
        const onKey = vi.fn();
        render(<Keyed onKey={onKey} />);
        fireEvent.keyDown(window, { key: "n" });
        fireEvent.keyDown(window, { key: "N" });
        fireEvent.keyDown(window, { key: "n", metaKey: true });
        fireEvent.keyDown(window, { key: "m" });
        expect(onKey).toHaveBeenCalledTimes(2);
    });

    it("stay quiet while typing, and while a dialog or a menu is open", () => {
        const onKey = vi.fn();
        const { getByLabelText } = render(<Keyed onKey={onKey} />);
        fireEvent.keyDown(getByLabelText("field"), { key: "n" });

        const menu = document.createElement("div");
        menu.setAttribute("role", "menu");
        document.body.appendChild(menu);
        fireEvent.keyDown(window, { key: "n" });
        menu.setAttribute("role", "dialog");
        fireEvent.keyDown(window, { key: "n" });
        menu.remove();

        expect(onKey).not.toHaveBeenCalled();
        fireEvent.keyDown(window, { key: "n" });
        expect(onKey).toHaveBeenCalledOnce();
    });
});
