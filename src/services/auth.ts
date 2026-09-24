/** Sign-in against the API. Tokens live in this browser session only. */
import type { DemoRole } from "../domain/types";
import { apiRequest } from "./api";

const TOKEN_KEY = "neurotech.events.auth-token";

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
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Session storage unavailable; the token still works for this page load.
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function register(input: { email: string; password: string; full_name: string; profile?: Partial<AuthProfile> }): Promise<TokenResponse> {
  return apiRequest<TokenResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function fetchMe(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/me", {}, token);
}

export function updateMe(token: string, patch: Partial<AuthProfile> & { full_name?: string }): Promise<AuthUser> {
  return apiRequest<AuthUser>("/me", { method: "PATCH", body: JSON.stringify(patch) }, token);
}

/** Map server roles onto the two workspaces the frontend renders. */
export function roleToDemoRole(role: string): DemoRole {
  return role === "platform_admin" || role === "event_admin" || role === "event_staff" ? "admin" : "attendee";
}
