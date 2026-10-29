// jsdom provides no IndexedDB, so every store backed by it failed at runtime.
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock SvelteKit environment
vi.mock("$app/environment", () => ({
  browser: true,
  dev: true,
  building: false,
  version: "test",
}));

// Mock window.matchMedia (only in browser environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
