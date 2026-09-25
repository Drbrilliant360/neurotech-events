/** Sign-in against the API. Tokens live in this browser session only (see `services/api`). */
import type { DemoRole } from "../domain/types";
import { apiRequest, authRequest, readTokens, writeTokens } from "./api";

export interface AuthProfile {
  phone?: string | null;
  organization?: string | null;
  job_title?: string | null;
  country?: string | null;
  interests: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  profile: AuthProfile | null;
  attendee_id: string | null;
  organizer: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: AuthUser;
}

function remember(result: TokenResponse): AuthUser {
  writeTokens({ accessToken: result.access_token, refreshToken: result.refresh_token });
  return result.user;
}

export function hasSession(): boolean {
  return readTokens() !== null;
}

/** Access token for the current session, or null. */
export function getAuthToken(): string | null {
  return readTokens()?.accessToken ?? null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return remember(await apiRequest<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
}

export async function register(input: { email: string; password: string; full_name: string; profile?: Partial<AuthProfile> }): Promise<AuthUser> {
  return remember(await apiRequest<TokenResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }));
}

export function fetchMe(): Promise<AuthUser> {
  return authRequest<AuthUser>("/me");
}

export function updateMe(patch: Partial<AuthProfile> & { full_name?: string }): Promise<AuthUser> {
  return authRequest<AuthUser>("/me", { method: "PATCH", body: JSON.stringify(patch) });
}

/** Revoke this session on the server (best effort) and forget the tokens locally. */
export async function logoutSession(): Promise<void> {
  const tokens = readTokens();
  writeTokens(null);
  if (!tokens) return;
  try {
    await apiRequest("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: tokens.refreshToken }) });
  } catch {
    // Already signed out locally; the refresh token also expires on its own.
  }
}

export function clearAuthToken(): void {
  writeTokens(null);
}

/** Map a server account onto the two workspaces the frontend renders. */
export function workspaceFor(user: Pick<AuthUser, "role" | "organizer">): DemoRole {
  return user.organizer || user.role === "platform_admin" ? "admin" : "attendee";
}

/** @deprecated kept for callers that only know the role string; prefer `workspaceFor`. */
export function roleToDemoRole(role: string): DemoRole {
  return role === "platform_admin" || role === "event_admin" || role === "event_staff" ? "admin" : "attendee";
}
