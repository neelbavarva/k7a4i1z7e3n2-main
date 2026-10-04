// What jsdom doesn't have, for components that use it.
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Node has a localStorage of its own (empty without a storage file) that hides jsdom's
for (const name of ["localStorage", "sessionStorage"]) {
    Object.defineProperty(globalThis, name, { value: globalThis.jsdom.window[name], configurable: true, writable: true });
}

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});

window.matchMedia ||= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
window.ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
};
Element.prototype.scrollIntoView ||= function () {};
Element.prototype.hasPointerCapture ||= () => false;
Element.prototype.releasePointerCapture ||= () => {};
