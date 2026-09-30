/**
 * In-memory stand-in for the Neurotech Events API, installed as `fetch`.
 * Each test starts from a fresh copy and can override any route.
 */
import { vi } from "vitest";

export const MEETUP_ID = "11111111-1111-4111-8111-111111111111";
export const SUMMIT_ID = "22222222-2222-4222-8222-222222222222";
export const REGISTRATION_ID = "33333333-3333-4333-8333-333333333333";
export const ATTENDEE_ID = "44444444-4444-4444-8444-444444444444";

const ticket = (id: string, eventId: string, code: string, name: string, price: number) => ({
  id, event_id: eventId, code, name, tier: price ? "professional" : "student", price, currency: "TZS",
  perks: "", capacity: 100, sold: 0, available: 100, active: true,
});

const event = (id: string, slug: string, title: string, tickets: ReturnType<typeof ticket>[], featured = false) => ({
  id, organization_id: "org-1", slug, title, subtitle: "", description: `${title} description`, theme: "", category: "Meetup",
  status: "published", format: "physical", starts_at: "2026-11-20T09:00:00+03:00", ends_at: "2026-11-20T17:00:00+03:00",
  capacity: 150, registration_opens_at: null, registration_closes_at: null, featured, banner_label: "Meetup",
  highlights: [], faqs: [], venue: { id: "venue-1", name: "Neurotech Africa HQ", city: "Dar es Salaam", country: "Tanzania" },
  ticket_types: tickets,
});

export function catalogue() {
  return {
    organization: {
      id: "org-1", name: "Neurotech Africa", brand_name: "Neurotech Events", contact_email: "info@neurotech.africa",
      contact_phone: "+255 699 920 009", default_currency: "TZS", default_city: "Dar es Salaam", default_country: "Tanzania",
      vat_percent: "18", registration_open_by_default: true, notify_on_registration: true, notify_on_payment: true,
    },
    events: [
      event(MEETUP_ID, "generative-ai-tanzania-meetup", "Generative AI Tanzania Meetup", [ticket("t-free", MEETUP_ID, "tix_z", "Community seat", 0)]),
      event(SUMMIT_ID, "neurotech-summit-2026", "Neurotech Summit 2026", [ticket("t-pro", SUMMIT_ID, "tix_pro", "Professional", 100000)], true),
    ],
    venues: [], sessions: [], speakers: [], milestones: [], sponsors: [],
  };
}

export function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1", email: "demo-user@example.com", full_name: "Demo User", role: "attendee", is_active: true,
    email_verified: true, profile: null, attendee_id: ATTENDEE_ID, organizer: false, ...overrides,
  };
}

export function workspace(registrations: unknown[] = []) {
  const { events, organization } = catalogue();
  return {
    organizations: [organization],
    events: events.map(({ ticket_types: _tickets, ...rest }) => ({ ...rest, counts: { registrations: 0, confirmed: 0, pending: 0, checked_in: 0 } })),
    access: events.map((item) => ({
      event_id: item.id, organization_id: "org-1", is_platform_admin: true, organization_roles: [], event_roles: [],
      can_manage_event: true, can_manage_finance: true, can_check_in: true,
    })),
    ticket_types: events.flatMap((item) => item.ticket_types),
    sessions: [], milestones: [], speakers: [], venues: [], registrations, check_ins: [], payments: [], sponsors: [], communications: [],
  };
}

const engagement = { schedule: [], notifications: [], networking: { profile: null, people: [], connections: [] }, certificates: [] };

export interface Call { method: string; path: string; body: unknown; auth: string | null }
type Reply = { status?: number; body?: unknown };
type Handler = (call: Call) => Reply | undefined;

export function installFakeApi(routes: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  const defaults: Record<string, Handler> = {
    "GET /catalogue": () => ({ body: catalogue() }),
    "GET /attendee/registrations": () => ({ body: [] }),
    "GET /me/schedule": () => ({ body: engagement.schedule }),
    "GET /me/notifications": () => ({ body: engagement.notifications }),
    "GET /me/networking": () => ({ body: engagement.networking }),
    "GET /me/certificates": () => ({ body: engagement.certificates }),
    "GET /admin/workspace": () => ({ body: workspace() }),
    "POST /auth/logout": () => ({ status: 204 }),
  };
  const table = { ...defaults, ...routes };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    const call: Call = { method, path, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: headers.get("Authorization") };
    calls.push(call);
    const handler = table[`${method} ${path}`] ?? Object.entries(table).find(([key]) => matches(key, `${method} ${path}`))?.[1];
    const reply = handler?.(call) ?? { status: 404, body: { error: { code: "not_found", message: `No fake route for ${method} ${path}` } } };
    const status = reply.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? {}), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock, find: (method: string, path: string) => calls.filter((item) => item.method === method && item.path === path) };
}

/** Route keys may use `*` for one path segment, e.g. `POST /admin/events/*\/check-ins`. */
function matches(pattern: string, actual: string): boolean {
  const regex = new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, "\\$&")).join("[^/]+")}$`);
  return regex.test(actual);
}

export function tokens(overrides: Record<string, unknown> = {}) {
  return { access_token: "access-1", refresh_token: "refresh-1", expires_in: 1800, token_type: "bearer", ...overrides };
}

/** Start a test already signed in (as the provider would after a page reload). */
export function signedIn() {
  sessionStorage.setItem("neurotech.events.session", JSON.stringify({ accessToken: "access-1", refreshToken: "refresh-1" }));
}
