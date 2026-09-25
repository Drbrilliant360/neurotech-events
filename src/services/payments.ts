/**
 * Client for the Neurotech Events API payment endpoints.
 *
 * Live payments are enabled only when `VITE_API_BASE_URL` is configured. The server owns
 * prices, provider calls and confirmation; this module only relays requests and statuses.
 */
import type { PaymentMethod, PaymentStatus } from "../domain/types";
import { ApiError, apiRequest, isApiEnabled, optionalAuthRequest } from "./api";

export const isLivePaymentsEnabled = isApiEnabled;
export const PaymentApiError = ApiError;
export type PaymentApiError = ApiError;

const request = apiRequest;

export type MobileMethod = Extract<PaymentMethod, "mpesa" | "airtel" | "mixx" | "halopesa">;

export interface StartMobilePaymentInput {
  event_slug: string;
  ticket_code: string;
  phone_number: string;
  method: MobileMethod;
  attendee: { full_name: string; email: string; organization?: string; job_title?: string; country?: string };
  client_reference?: string;
}

export interface RemotePaymentEvent {
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}

export interface RemotePayment {
  id: string;
  reference: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider: string | null;
  provider_reference: string | null;
  registration_id: string;
  registration_status: string;
  event_id: string;
  attendee_id: string;
  ticket_type_id: string;
  ticket_number: string;
  event_slug: string;
  event_title: string;
  ticket_name: string;
  attendee_name: string;
  attendee_email: string;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  events: RemotePaymentEvent[];
}

export interface RemotePaymentPage {
  items: RemotePayment[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProviderTransaction {
  reference?: string;
  id?: string;
  status?: string;
  amount?: { value?: number; currency?: string } | number;
  channel?: { type?: string; provider?: string };
  customer?: { first_name?: string; last_name?: string; name?: string; email?: string; phone?: string };
  settlement?: { gross?: { value?: number }; fees?: { value?: number }; net?: { value?: number } };
  metadata?: Record<string, unknown>;
  created_at?: string;
  completed_at?: string;
  failure_reason?: string | null;
  payment_type?: string;
  external_reference?: string;
}

export interface ProviderTransactionsPage {
  provider: string;
  items: ProviderTransaction[];
  raw: Record<string, unknown>;
}

export interface ProviderBalance {
  provider: string;
  available: number;
  balance: number;
  currency: string;
}

export function startMobilePayment(input: StartMobilePaymentInput): Promise<RemotePayment> {
  // Signed-in buyers are linked to their account so the ticket shows up under "My tickets".
  return optionalAuthRequest<RemotePayment>("/payments/mobile", { method: "POST", body: JSON.stringify(input) });
}

export function fetchPayment(paymentId: string): Promise<RemotePayment> {
  return request<RemotePayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export function fetchAdminPayments(token: string, params: { status?: string; page?: number; page_size?: number } = {}): Promise<RemotePaymentPage> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  const suffix = query.toString() ? `?${query}` : "";
  return request<RemotePaymentPage>(`/admin/payments${suffix}`, {}, token);
}

export function fetchProviderTransactions(token: string, params: { limit?: number; page?: number; status?: string } = {}): Promise<ProviderTransactionsPage> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.page) query.set("page", String(params.page));
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query}` : "";
  return request<ProviderTransactionsPage>(`/admin/payments/provider${suffix}`, {}, token);
}

export function fetchProviderBalance(token: string): Promise<ProviderBalance> {
  return request<ProviderBalance>("/admin/payments/balance", {}, token);
}

export function verifyAdminPayment(token: string, paymentId: string): Promise<RemotePayment> {
  return request<RemotePayment>(`/admin/payments/${encodeURIComponent(paymentId)}/verify`, { method: "POST" }, token);
}

export function providerAmount(item: ProviderTransaction): number {
  if (typeof item.amount === "number") return item.amount;
  return item.amount?.value ?? 0;
}

export function providerCustomer(item: ProviderTransaction): string {
  const c = item.customer;
  if (!c) return "—";
  return c.name ?? [c.first_name, c.last_name].filter(Boolean).join(" ") ?? c.email ?? c.phone ?? "—";
}

export interface TicketQuote {
  event_slug: string;
  code: string;
  name: string;
  tier: string;
  currency: string;
  price: number;
  vat_percent: number | string;
  vat: number;
  total: number;
  active: boolean;
  capacity: number;
  sold: number;
  available: number;
  payable_online: boolean;
}

/** The exact amount the server will charge for a ticket, VAT included. */
export function fetchTicketQuote(eventSlug: string, ticketCode: string): Promise<TicketQuote> {
  return request<TicketQuote>(`/events/${encodeURIComponent(eventSlug)}/tickets/${encodeURIComponent(ticketCode)}/quote`);
}

export interface CatalogueSyncResult {
  events_upserted: number;
  ticket_types_upserted: number;
  ticket_types_deactivated: number;
}

export function syncCatalogue(token: string, payload: unknown): Promise<CatalogueSyncResult> {
  return request<CatalogueSyncResult>("/admin/catalogue", { method: "PUT", body: JSON.stringify(payload) }, token);
}
