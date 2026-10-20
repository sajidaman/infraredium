import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn((contextType: string) => {
    if (contextType === "webgl2") return null;
    return {
      arc: vi.fn(),
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
    };
  }),
});
