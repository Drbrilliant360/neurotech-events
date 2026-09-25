/**
 * Shared client for the Neurotech Events API.
 *
 * Live features are enabled only when `VITE_API_BASE_URL` is configured. Without it the app
 * stays in local demo mode. Authenticated calls go through `authRequest`, which attaches the
 * session's access token and transparently rotates it with the refresh token on a 401.
 */
const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
export const API_BASE_URL = rawBase.replace(/\/+$/, "");
export const API_PREFIX = "/api/v1";

export function isApiEnabled(): boolean {
  return API_BASE_URL.length > 0;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function send(path: string, init: RequestInit, token?: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    return await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Could not reach the server.", "network_error", 0);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const envelope = (data ?? {}) as { error?: { code?: string; message?: string } };
    throw new ApiError(
      envelope.error?.message ?? `Request failed with status ${response.status}.`,
      envelope.error?.code ?? "request_failed",
      response.status,
    );
  }
  return data as T;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  if (!isApiEnabled()) throw new ApiError("The API is not configured.", "not_configured", 0);
  return parse<T>(await send(path, init, token));
}

// ------------------------------------------------------------------ session tokens

const SESSION_KEY = "neurotech.events.session";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function readTokens(): StoredTokens | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: StoredTokens | null): void {
  try {
    if (tokens) sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable (private mode); the session lasts for this page load only.
  }
}

type ExpiredListener = () => void;
const expiredListeners = new Set<ExpiredListener>();

/** Notified when the session can no longer be refreshed and the user must sign in again. */
export function onSessionExpired(listener: ExpiredListener): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

let refreshing: Promise<StoredTokens | null> | null = null;

/**
 * Rotate the refresh token. Concurrent callers share one in-flight request: the server revokes
 * the whole session if the same refresh token is presented twice.
 */
export function refreshTokens(): Promise<StoredTokens | null> {
  if (refreshing) return refreshing;
  const current = readTokens();
  if (!current) return Promise.resolve(null);
  refreshing = (async () => {
    try {
      const result = await apiRequest<{ access_token: string; refresh_token: string }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      });
      const next = { accessToken: result.access_token, refreshToken: result.refresh_token };
      writeTokens(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        writeTokens(null);
        expiredListeners.forEach((listener) => listener());
        return null;
      }
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Authenticated request with one automatic refresh-and-retry on an expired access token. */
export async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiEnabled()) throw new ApiError("The API is not configured.", "not_configured", 0);
  const tokens = readTokens();
  if (!tokens) throw new ApiError("Please sign in.", "missing_token", 401);
  let response = await send(path, init, tokens.accessToken);
  if (response.status === 401) {
    const rotated = await refreshTokens();
    if (!rotated) throw new ApiError("Your session has expired. Please sign in again.", "session_expired", 401);
    response = await send(path, init, rotated.accessToken);
  }
  return parse<T>(response);
}

/** Like `authRequest` when signed in, otherwise an anonymous request (guest checkout). */
export function optionalAuthRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return readTokens() ? authRequest<T>(path, init) : apiRequest<T>(path, init);
}

export async function checkApiHealth(): Promise<boolean> {
  if (!isApiEnabled()) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { headers: { Accept: "application/json" } });
    return response.ok;
  } catch {
    return false;
  }
}
