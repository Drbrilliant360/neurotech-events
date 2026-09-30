import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom does not implement these; the app calls them for scrolling and motion preferences.
window.scrollTo = () => undefined;
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
