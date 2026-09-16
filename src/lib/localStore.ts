const KEY = "neurotech.events.db.v1";

export function readJson<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(value: unknown): void {
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function clearJson(): void {
  localStorage.removeItem(KEY);
}

export const DEMO_ROLE_KEY = "neurotech.events.demo-role";
export const DEMO_ATTENDEE_KEY = "neurotech.events.demo-attendee";
