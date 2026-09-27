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

export interface SponsorDto {
  id: string;
  name: string;
  tier: string;
  website: string | null;
  /** Organiser views only; the public catalogue omits contact details. */
  contact?: string | null;
  active?: boolean;
  event_ids: string[];
}

export interface CommunicationDto {
  id: string;
  event_id: string;
  channel: string;
  audience: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export interface CatalogueDto {
  organization: OrganizationDto | null;
  events: EventDto[];
  venues: VenueDto[];
  sessions: SessionDto[];
  speakers: SpeakerDto[];
  milestones: MilestoneDto[];
  sponsors?: SponsorDto[];
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
  sponsors?: SponsorDto[];
  communications?: CommunicationDto[];
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

// ---------------------------------------------------------------- directory

export interface SpeakerInput {
  name?: string;
  initials?: string | null;
  role?: string | null;
  organization?: string | null;
  bio?: string | null;
  track?: string | null;
  social_url?: string | null;
}

export const createSpeaker = (input: SpeakerInput) =>
  authRequest<SpeakerDto>("/admin/speakers", { method: "POST", ...json(input) });
export const updateSpeaker = (id: string, input: SpeakerInput) =>
  authRequest<SpeakerDto>(`/admin/speakers/${id}`, { method: "PATCH", ...json(input) });
export const deleteSpeaker = (id: string) => authRequest<void>(`/admin/speakers/${id}`, { method: "DELETE" });

export type VenueInput = Partial<Omit<VenueDto, "id">>;

export const createVenue = (input: VenueInput) => authRequest<VenueDto>("/admin/venues", { method: "POST", ...json(input) });
export const updateVenue = (id: string, input: VenueInput) =>
  authRequest<VenueDto>(`/admin/venues/${id}`, { method: "PATCH", ...json(input) });

// --------------------------------------------------------------------- team

export type OrganizationRole = "owner" | "admin" | "finance" | "member";
export type EventStaffRole = "manager" | "staff" | "check_in" | "speaker";

export interface TeamMemberDto { user_id: string; email: string; full_name: string; role: string }
export interface EventStaffDto extends TeamMemberDto { event_id: string }
export interface OrganizationTeamDto { members: TeamMemberDto[]; event_staff: EventStaffDto[] }

export const fetchTeam = (organizationId: string) =>
  authRequest<OrganizationTeamDto>(`/admin/organizations/${organizationId}/team`);
export const addTeamMember = (organizationId: string, email: string, role: OrganizationRole) =>
  authRequest<TeamMemberDto>(`/admin/organizations/${organizationId}/team`, { method: "POST", ...json({ email, role }) });
export const removeTeamMember = (organizationId: string, userId: string) =>
  authRequest<void>(`/authorization/organizations/${organizationId}/memberships/${userId}`, { method: "DELETE" });
export const addEventStaff = (eventId: string, email: string, role: EventStaffRole) =>
  authRequest<EventStaffDto>(`/admin/events/${eventId}/staff`, { method: "POST", ...json({ email, role }) });
export const removeEventStaff = (eventId: string, userId: string) =>
  authRequest<void>(`/authorization/events/${eventId}/assignments/${userId}`, { method: "DELETE" });

// --------------------------------------------------------------- engagement

export interface SavedSessionDto { session_id: string; event_id: string; saved_at: string }
export interface NotificationDto { id: string; title: string; body: string | null; category: string; is_read: boolean; created_at: string }
export interface NetworkingProfileDto {
  attendee_id: string;
  public_name: string;
  initials: string | null;
  job_title: string | null;
  organization: string | null;
  interests: string[];
  bio: string | null;
  is_visible?: boolean;
}
export interface NetworkingDto { profile: NetworkingProfileDto | null; people: NetworkingProfileDto[]; connections: string[] }
export interface CertificateDto { id: string; certificate_code: string; event_id: string; event_title: string; event_slug: string; issued_at: string }
export interface CertificateVerificationDto {
  certificate_code: string;
  attendee_name: string;
  event_title: string;
  event_starts_on: string;
  event_ends_on: string;
  issued_at: string;
}

/** Everything the attendee workspace needs beyond registrations, loaded in parallel. */
export interface EngagementDto {
  schedule: SavedSessionDto[];
  notifications: NotificationDto[];
  networking: NetworkingDto;
  certificates: CertificateDto[];
}

export async function fetchEngagement(): Promise<EngagementDto> {
  const [schedule, notifications, networking, certificates] = await Promise.all([
    authRequest<SavedSessionDto[]>("/me/schedule"),
    authRequest<NotificationDto[]>("/me/notifications"),
    authRequest<NetworkingDto>("/me/networking"),
    authRequest<CertificateDto[]>("/me/certificates"),
  ]);
  return { schedule, notifications, networking, certificates };
}

export const saveSession = (sessionId: string) => authRequest<void>(`/me/schedule/${sessionId}`, { method: "PUT" });
export const unsaveSession = (sessionId: string) => authRequest<void>(`/me/schedule/${sessionId}`, { method: "DELETE" });
export const markNotificationRead = (id: string) =>
  authRequest<NotificationDto>(`/me/notifications/${id}/read`, { method: "POST" });
export const markAllNotificationsRead = () => authRequest<{ updated: number }>("/me/notifications/read-all", { method: "POST" });
export const connectWith = (attendeeId: string) =>
  authRequest<void>("/me/networking/connections", { method: "POST", ...json({ attendee_id: attendeeId }) });
export const disconnectFrom = (attendeeId: string) =>
  authRequest<void>(`/me/networking/connections/${attendeeId}`, { method: "DELETE" });

export interface NetworkingProfileInput {
  public_name: string;
  job_title?: string | null;
  organization?: string | null;
  interests: string[];
  bio?: string | null;
  is_visible: boolean;
}

export const saveNetworkingProfile = (input: NetworkingProfileInput) =>
  authRequest<NetworkingProfileDto>("/me/networking/profile", { method: "PUT", ...json(input) });
export const verifyCertificate = (code: string) =>
  apiRequest<CertificateVerificationDto>(`/certificates/${encodeURIComponent(code)}/verify`);

// ------------------------------------------------------------------ outreach

export interface SponsorInput {
  name?: string;
  tier?: string;
  website?: string | null;
  contact?: string | null;
  active?: boolean;
  event_ids?: string[];
}

export const createSponsor = (input: SponsorInput) => authRequest<SponsorDto>("/admin/sponsors", { method: "POST", ...json(input) });
export const updateSponsor = (id: string, input: SponsorInput) =>
  authRequest<SponsorDto>(`/admin/sponsors/${id}`, { method: "PATCH", ...json(input) });
export const deleteSponsor = (id: string) => authRequest<void>(`/admin/sponsors/${id}`, { method: "DELETE" });

export interface CommunicationInput { channel: string; audience: string; subject: string; body: string }

export const createCommunication = (eventId: string, input: CommunicationInput) =>
  authRequest<CommunicationDto>(`/admin/events/${eventId}/communications`, { method: "POST", ...json(input) });
export const sendCommunication = (id: string) =>
  authRequest<CommunicationDto & { recipients: number; external_delivery: string }>(`/admin/communications/${id}/send`, { method: "POST" });
export const deleteCommunication = (id: string) => authRequest<void>(`/admin/communications/${id}`, { method: "DELETE" });
export const issueCertificates = (eventId: string) =>
  authRequest<{ issued: number; total: number }>(`/admin/events/${eventId}/certificates/issue`, { method: "POST" });
