/**
 * Typed client for the organiser, attendee and public catalogue endpoints.
 * Shapes mirror the FastAPI response models one to one (snake_case on the wire).
 */
import { apiRequest, authRequest, optionalAuthRequest } from "./api";
import type { RemotePayment } from "./payments";

export interface VenueDto { id: string; name: string; address?: string | null; city: string | null; region?: string | null; country: string | null }

export interface TicketTypeDto {
  id: string;
  event_id?: string;
  code: string | null;
  name: string;
  tier: string;
  price: number;
  currency: string;
  perks: string | null;
  capacity: number;
  sold: number;
  available?: number;
  active: boolean;
  sales_start_at?: string | null;
  sales_end_at?: string | null;
  sort_order?: number;
}

export interface EventDto {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  theme: string | null;
  category: string | null;
  status: string;
  format: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  featured: boolean;
  banner_label: string | null;
  highlights: string[];
  faqs: string[];
  venue: VenueDto | null;
  ticket_types?: TicketTypeDto[];
  counts?: { registrations: number; confirmed: number; pending: number; checked_in: number };
}

export interface SpeakerDto { id: string; name: string; initials: string | null; role: string | null; organization: string | null; bio: string | null; track: string | null; social_url: string | null }

export interface SessionDto {
  id: string;
  event_id: string;
  title: string;
  day_index: number;
  day_label: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  session_type: string;
  description: string | null;
  speaker_label: string | null;
  speaker: SpeakerDto | null;
}

export interface MilestoneDto { id: string; event_id: string; title: string; milestone_date: string; status: string; day_index: number | null }

export interface OrganizationDto {
  id: string;
  name: string;
  brand_name: string;
  contact_email: string;
  contact_phone: string | null;
  default_currency: string;
  default_city: string | null;
  default_country: string | null;
  vat_percent: string | number;
  registration_open_by_default: boolean;
  notify_on_registration: boolean;
  notify_on_payment: boolean;
}

export interface CatalogueDto {
  organization: OrganizationDto | null;
  events: EventDto[];
  venues: VenueDto[];
  sessions: SessionDto[];
  speakers: SpeakerDto[];
  milestones: MilestoneDto[];
}

export interface EventAccessDto {
  event_id: string;
  organization_id: string;
  is_platform_admin: boolean;
  organization_roles: string[];
  event_roles: string[];
  can_manage_event: boolean;
  can_manage_finance: boolean;
  can_check_in: boolean;
}

export interface AdminRegistrationDto {
  id: string;
  event_id: string;
  ticket_number: string;
  status: string;
  attendee_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string | null;
  attendee_organization: string | null;
  ticket_type_id: string;
  ticket_name: string;
  amount_paid: number;
  checked_in_at: string | null;
  created_at: string;
  cancelled_at: string | null;
}

export interface CheckInDto {
  id: string;
  event_id: string;
  attendee_id: string;
  registration_id: string;
  ticket_number: string;
  attendee_name: string;
  ticket_name: string;
  checked_in_at: string;
  checked_in_by: string | null;
  undone: boolean;
}

export interface WorkspaceDto {
  organizations: OrganizationDto[];
  events: EventDto[];
  access: EventAccessDto[];
  ticket_types: TicketTypeDto[];
  sessions: SessionDto[];
  milestones: MilestoneDto[];
  speakers: SpeakerDto[];
  venues: VenueDto[];
  registrations: AdminRegistrationDto[];
  check_ins: CheckInDto[];
  payments: RemotePayment[];
}

export interface AttendeeRegistrationDto {
  id: string;
  event_id: string;
  event_slug: string;
  event_title: string;
  event_status: string;
  event_starts_at: string;
  event_ends_at: string;
  attendee_id: string;
  ticket_type_id: string;
  ticket_code: string | null;
  ticket_name: string;
  ticket_price: number;
  currency: string;
  ticket_number: string;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  payment_id: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  amount_paid: number;
  checked_in_at: string | null;
}

export interface AttendeeTicketDto {
  registration_id: string;
  ticket_number: string;
  event_slug: string;
  event_title: string;
  ticket_name: string;
  attendee_name: string;
  starts_at: string;
  qr_payload: string;
  checked_in_at: string | null;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

// ---------------------------------------------------------------- public / attendee

export const fetchCatalogue = () => apiRequest<CatalogueDto>("/catalogue");

export const fetchMyRegistrations = () => authRequest<AttendeeRegistrationDto[]>("/attendee/registrations");

export const cancelMyRegistration = (id: string) =>
  authRequest<AttendeeRegistrationDto>(`/attendee/registrations/${id}`, { method: "DELETE" });

export const fetchMyTicket = (id: string) => authRequest<AttendeeTicketDto>(`/attendee/registrations/${id}/ticket`);

export const registerFree = (input: {
  event_slug: string;
  ticket_code: string;
  phone_number?: string;
  attendee: { full_name: string; email: string; organization?: string; job_title?: string; country?: string };
}) => optionalAuthRequest<AttendeeRegistrationDto>("/registrations/free", { method: "POST", ...json(input) });

export const resendPaymentPrompt = (paymentId: string) =>
  apiRequest<RemotePayment>(`/payments/${paymentId}/push`, { method: "POST" });

// ---------------------------------------------------------------------- organiser

export const fetchWorkspace = () => authRequest<WorkspaceDto>("/admin/workspace");

export interface EventInput {
  slug?: string;
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  theme?: string | null;
  category?: string | null;
  format?: string;
  starts_at?: string;
  ends_at?: string;
  capacity?: number;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  featured?: boolean;
  banner_label?: string | null;
  highlights?: string[];
  faqs?: string[];
  venue_id?: string | null;
  organization_id?: string;
}

export const createEvent = (input: EventInput) => authRequest<EventDto>("/admin/events", { method: "POST", ...json(input) });
export const updateEvent = (id: string, input: EventInput) =>
  authRequest<EventDto>(`/admin/events/${id}`, { method: "PATCH", ...json(input) });
export const changeEventStatus = (id: string, status: string) =>
  authRequest<EventDto>(`/admin/events/${id}/status`, { method: "POST", ...json({ status }) });
export const duplicateEvent = (id: string) => authRequest<EventDto>(`/admin/events/${id}/duplicate`, { method: "POST" });
export const deleteEvent = (id: string) => authRequest<void>(`/admin/events/${id}`, { method: "DELETE" });

export interface TicketInput {
  code?: string;
  name?: string;
  tier?: string;
  price?: number;
  perks?: string | null;
  capacity?: number;
  active?: boolean;
}

export const createTicketType = (eventId: string, input: TicketInput) =>
  authRequest<TicketTypeDto>(`/admin/events/${eventId}/ticket-types`, { method: "POST", ...json(input) });
export const updateTicketType = (eventId: string, id: string, input: TicketInput) =>
  authRequest<TicketTypeDto>(`/admin/events/${eventId}/ticket-types/${id}`, { method: "PATCH", ...json(input) });
export const deleteTicketType = (eventId: string, id: string) =>
  authRequest<void>(`/admin/events/${eventId}/ticket-types/${id}`, { method: "DELETE" });

export interface SessionInput {
  title?: string;
  session_date?: string;
  start_time?: string;
  end_time?: string;
  day_label?: string | null;
  room?: string | null;
  session_type?: string;
  description?: string | null;
  speaker_id?: string | null;
  speaker_label?: string | null;
}

export const createSession = (eventId: string, input: SessionInput) =>
  authRequest<SessionDto>(`/admin/events/${eventId}/sessions`, { method: "POST", ...json(input) });
export const updateSession = (eventId: string, id: string, input: SessionInput) =>
  authRequest<SessionDto>(`/admin/events/${eventId}/sessions/${id}`, { method: "PATCH", ...json(input) });
export const deleteSession = (eventId: string, id: string) =>
  authRequest<void>(`/admin/events/${eventId}/sessions/${id}`, { method: "DELETE" });

export interface MilestoneInput { title?: string; milestone_date?: string; status?: string; day_index?: number | null }

export const createMilestone = (eventId: string, input: MilestoneInput) =>
  authRequest<MilestoneDto>(`/admin/events/${eventId}/milestones`, { method: "POST", ...json(input) });
export const updateMilestone = (eventId: string, id: string, input: MilestoneInput) =>
  authRequest<MilestoneDto>(`/admin/events/${eventId}/milestones/${id}`, { method: "PATCH", ...json(input) });
export const deleteMilestone = (eventId: string, id: string) =>
  authRequest<void>(`/admin/events/${eventId}/milestones/${id}`, { method: "DELETE" });

export const checkInTicket = (eventId: string, code: string) =>
  authRequest<CheckInDto>(`/admin/events/${eventId}/check-ins`, { method: "POST", ...json({ code }) });
export const undoCheckIn = (eventId: string, id: string) =>
  authRequest<CheckInDto>(`/admin/events/${eventId}/check-ins/${id}/undo`, { method: "POST" });

export const updateOrganization = (id: string, input: Partial<Omit<OrganizationDto, "id">>) =>
  authRequest<OrganizationDto>(`/admin/organizations/${id}`, { method: "PATCH", ...json(input) });

export async function downloadRegistrationsCsv(eventId: string): Promise<string> {
  return authRequest<string>(`/admin/events/${eventId}/registrations.csv`);
}
