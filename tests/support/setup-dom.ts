import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered components between tests so DOM state never leaks
afterEach(() => cleanup());

// ---- Browser APIs that jsdom doesn't implement but Radix UI uses ----
// jsdom is a DOM *simulation* without layout, so anything measuring or capturing the pointer is missing.

// Radix RadioGroup / Checkbox / Select measure elements with ResizeObserver
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Radix Select uses pointer capture and scrolls the selected option into view
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
