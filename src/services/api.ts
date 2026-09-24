/**
 * Shared client for the Neurotech Events API.
 *
 * Live features (payments, sign-in, catalogue publishing) are enabled only when
 * `VITE_API_BASE_URL` is configured. Without it the app stays in local demo mode.
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

export async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  if (!isApiEnabled()) throw new ApiError("The API is not configured.", "not_configured", 0);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Could not reach the server.", "network_error", 0);
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
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

export async function checkApiHealth(): Promise<boolean> {
  if (!isApiEnabled()) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { headers: { Accept: "application/json" } });
    return response.ok;
  } catch {
    return false;
  }
}
