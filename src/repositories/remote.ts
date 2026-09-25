/**
 * Builds the in-memory `PlatformDatabase` the pages render from API responses.
 *
 * Server-owned collections (events, venues, tickets, programme, registrations, payments,
 * check-ins, settings) always come from the API. Collections the backend does not model yet
 * (sponsors, communications, notifications, networking, certificates, saved sessions) stay in
 * the browser's demo store and are clearly local. Checkout drafts (a registration form that has
 * not been paid for yet) live in session storage until the server creates the registration.
 */
import type {
  Attendee,
  CheckIn,
  Event,
  EventFormat,
  EventStatus,
  MilestoneStatus,
  OrganizationSettings,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PlatformDatabase,
  Registration,
  RegistrationStatus,
  Session,
  SessionType,
  Speaker,
  TicketTier,
  TicketType,
  TimelineMilestone,
  Venue,
} from "../domain/types";
import type { AuthUser } from "../services/auth";
import type { RemotePayment } from "../services/payments";
import type {
  AdminRegistrationDto,
  AttendeeRegistrationDto,
  CatalogueDto,
  CheckInDto,
  EventDto,
  MilestoneDto,
  OrganizationDto,
  SessionDto,
  SpeakerDto,
  TicketTypeDto,
  VenueDto,
  WorkspaceDto,
} from "../services/platformApi";

export const TBA_VENUE_ID = "venue-tba";
const TBA_VENUE: Venue = { id: TBA_VENUE_ID, name: "Venue to be announced", address: "", city: "", region: "", country: "" };

const text = (value: string | null | undefined) => value ?? "";

export function toVenue(dto: VenueDto): Venue {
  return { id: dto.id, name: dto.name, address: text(dto.address), city: text(dto.city), region: text(dto.region), country: text(dto.country) };
}

export function toEvent(dto: EventDto): Event {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    subtitle: text(dto.subtitle),
    description: text(dto.description),
    theme: text(dto.theme),
    category: text(dto.category),
    status: dto.status as EventStatus,
    format: dto.format as EventFormat,
    startsAt: dto.starts_at,
    endsAt: dto.ends_at,
    venueId: dto.venue?.id ?? TBA_VENUE_ID,
    capacity: dto.capacity,
    registrationOpensAt: text(dto.registration_opens_at),
    registrationClosesAt: text(dto.registration_closes_at),
    featured: dto.featured,
    bannerLabel: text(dto.banner_label ?? dto.category),
    highlights: dto.highlights ?? [],
    faqs: dto.faqs ?? [],
  };
}

export function toTicket(dto: TicketTypeDto, eventId: string): TicketType {
  return {
    id: dto.id,
    code: dto.code ?? undefined,
    eventId: dto.event_id ?? eventId,
    name: dto.name,
    tier: dto.tier as TicketTier,
    price: dto.price,
    currency: dto.currency,
    perks: text(dto.perks),
    capacity: dto.capacity,
    sold: dto.sold,
    active: dto.active,
  };
}

export function toSpeaker(dto: SpeakerDto): Speaker {
  return {
    id: dto.id,
    name: dto.name,
    initials: text(dto.initials),
    role: text(dto.role),
    organization: text(dto.organization),
    bio: text(dto.bio),
    track: text(dto.track),
    socialUrl: dto.social_url ?? undefined,
  };
}

export function toSession(dto: SessionDto): Session {
  return {
    id: dto.id,
    eventId: dto.event_id,
    title: dto.title,
    dayIndex: dto.day_index,
    dayLabel: dto.day_label ?? `Day ${dto.day_index + 1}`,
    date: dto.session_date,
    startTime: dto.start_time.slice(0, 5),
    endTime: dto.end_time.slice(0, 5),
    speakerId: dto.speaker?.id,
    speakerLabel: dto.speaker_label ?? dto.speaker?.name ?? "TBA",
    room: text(dto.room),
    type: dto.session_type as SessionType,
    description: text(dto.description),
  };
}

export function toMilestone(dto: MilestoneDto): TimelineMilestone {
  return {
    id: dto.id,
    eventId: dto.event_id,
    title: dto.title,
    date: dto.milestone_date,
    status: dto.status as MilestoneStatus,
    dayIndex: dto.day_index ?? undefined,
  };
}

export function toSettings(dto: OrganizationDto, fallback: OrganizationSettings): OrganizationSettings {
  return {
    ...fallback,
    organizationName: dto.name,
    brandName: dto.brand_name,
    contactEmail: dto.contact_email,
    contactPhone: text(dto.contact_phone),
    defaultCurrency: dto.default_currency,
    defaultCity: text(dto.default_city),
    defaultCountry: text(dto.default_country),
    vatPercent: Number(dto.vat_percent),
    registrationOpenByDefault: dto.registration_open_by_default,
    notifyOnRegistration: dto.notify_on_registration,
    notifyOnPayment: dto.notify_on_payment,
  };
}

export function toPayment(dto: RemotePayment): Payment {
  return {
    id: dto.id,
    registrationId: dto.registration_id,
    attendeeId: dto.attendee_id,
    eventId: dto.event_id,
    reference: dto.reference,
    amount: dto.amount,
    currency: dto.currency,
    method: dto.method,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    provider: "snippe",
    providerPaymentId: dto.id,
    providerReference: dto.provider_reference ?? undefined,
  };
}

function toCheckIn(dto: CheckInDto): CheckIn {
  return {
    id: dto.id,
    registrationId: dto.registration_id,
    attendeeId: dto.attendee_id,
    eventId: dto.event_id,
    ticketNumber: dto.ticket_number,
    checkedInAt: dto.checked_in_at,
    undone: dto.undone,
  };
}

function blankAttendee(id: string, fullName: string, email: string): Attendee {
  return { id, fullName, email, phone: "", organization: "", jobTitle: "", country: "", roleTitle: "", interests: [], isDemoUser: false };
}

export function attendeeFromUser(user: AuthUser): Attendee {
  const profile = user.profile;
  return {
    ...blankAttendee(user.attendee_id ?? user.id, user.full_name, user.email),
    phone: text(profile?.phone),
    organization: text(profile?.organization),
    jobTitle: text(profile?.job_title),
    roleTitle: text(profile?.job_title),
    country: text(profile?.country),
    interests: profile?.interests ?? [],
  };
}

// --------------------------------------------------------------------- drafts

const DRAFTS_KEY = "neurotech.events.checkout-drafts";

export interface CheckoutDrafts {
  registrations: Registration[];
  payments: Payment[];
  attendees: Attendee[];
}

const EMPTY_DRAFTS: CheckoutDrafts = { registrations: [], payments: [], attendees: [] };

export function readDrafts(): CheckoutDrafts {
  try {
    const raw = sessionStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as CheckoutDrafts) : EMPTY_DRAFTS;
  } catch {
    return EMPTY_DRAFTS;
  }
}

export function writeDrafts(drafts: CheckoutDrafts): void {
  try {
    sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Storage unavailable; the draft lives for this page load.
  }
}

// ------------------------------------------------------------------- assembly

export interface LiveSources {
  catalogue: CatalogueDto;
  workspace?: WorkspaceDto;
  user?: AuthUser;
  myRegistrations?: AttendeeRegistrationDto[];
}

function unique<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

/** Rebuild the database: server data first, local-only collections and drafts on top. */
export function buildLiveDatabase(local: PlatformDatabase, sources: LiveSources): PlatformDatabase {
  const { catalogue, workspace, user, myRegistrations } = sources;
  const eventDtos = workspace ? workspace.events : catalogue.events;
  const events = eventDtos.map(toEvent);

  const ticketTypes = workspace
    ? workspace.ticket_types.map((dto) => toTicket(dto, dto.event_id ?? ""))
    : catalogue.events.flatMap((event) => (event.ticket_types ?? []).map((dto) => toTicket(dto, event.id)));
  const sessions = (workspace ?? catalogue).sessions.map(toSession);
  const milestones = (workspace ?? catalogue).milestones.map(toMilestone);
  const speakers = unique((workspace ?? catalogue).speakers.map(toSpeaker));
  const venues = unique([
    ...(workspace ?? catalogue).venues.map(toVenue),
    ...eventDtos.flatMap((event) => (event.venue ? [toVenue(event.venue)] : [])),
    TBA_VENUE,
  ]);

  const organization = workspace?.organizations[0] ?? catalogue.organization;
  const settings = organization ? toSettings(organization, local.settings) : local.settings;

  let registrations: Registration[] = [];
  let payments: Payment[] = [];
  let checkIns: CheckIn[] = [];
  let attendees: Attendee[] = [];

  if (workspace) {
    registrations = workspace.registrations.map((dto: AdminRegistrationDto) => ({
      id: dto.id,
      eventId: dto.event_id,
      attendeeId: dto.attendee_id,
      ticketTypeId: dto.ticket_type_id,
      status: dto.status as RegistrationStatus,
      ticketNumber: dto.ticket_number,
      createdAt: dto.created_at,
    }));
    attendees = unique(
      workspace.registrations.map((dto) => ({
        ...blankAttendee(dto.attendee_id, dto.attendee_name, dto.attendee_email),
        phone: text(dto.attendee_phone),
        organization: text(dto.attendee_organization),
      })),
    );
    payments = workspace.payments.map(toPayment);
    checkIns = workspace.check_ins.map(toCheckIn);
  }

  if (myRegistrations) {
    for (const dto of myRegistrations) {
      registrations.push({
        id: dto.id,
        eventId: dto.event_id,
        attendeeId: dto.attendee_id,
        ticketTypeId: dto.ticket_type_id,
        status: dto.status as RegistrationStatus,
        ticketNumber: dto.ticket_number,
        createdAt: dto.created_at,
      });
      if (dto.payment_id) {
        payments.push({
          id: dto.payment_id,
          registrationId: dto.id,
          attendeeId: dto.attendee_id,
          eventId: dto.event_id,
          reference: dto.payment_reference ?? "",
          amount: dto.amount_paid,
          currency: dto.currency,
          method: (dto.payment_method ?? "mpesa") as PaymentMethod,
          status: (dto.payment_status ?? "pending") as PaymentStatus,
          createdAt: dto.created_at,
          updatedAt: dto.created_at,
          provider: "snippe",
          providerPaymentId: dto.payment_id,
        });
      }
      if (dto.checked_in_at) {
        checkIns.push({
          id: `checkin-${dto.id}`,
          registrationId: dto.id,
          attendeeId: dto.attendee_id,
          eventId: dto.event_id,
          ticketNumber: dto.ticket_number,
          checkedInAt: dto.checked_in_at,
          undone: false,
        });
      }
    }
  }
  if (user) attendees.push(attendeeFromUser(user));

  // An attendee keeps seeing tickets for events that are no longer public (cancelled or
  // completed-and-hidden), so fill in any event or ticket type the catalogue did not include.
  for (const dto of myRegistrations ?? []) {
    if (!events.some((event) => event.id === dto.event_id)) {
      events.push({
        id: dto.event_id, slug: dto.event_slug, title: dto.event_title, subtitle: "", description: "", theme: "",
        category: "", status: dto.event_status as EventStatus, format: "physical", startsAt: dto.event_starts_at,
        endsAt: dto.event_ends_at, venueId: TBA_VENUE_ID, capacity: 0, registrationOpensAt: "", registrationClosesAt: "",
        featured: false, bannerLabel: "", highlights: [], faqs: [],
      });
    }
    if (!ticketTypes.some((ticket) => ticket.id === dto.ticket_type_id)) {
      ticketTypes.push({
        id: dto.ticket_type_id, code: dto.ticket_code ?? undefined, eventId: dto.event_id, name: dto.ticket_name,
        tier: "professional", price: dto.ticket_price, currency: dto.currency, perks: "", capacity: 0, sold: 0, active: false,
      });
    }
  }

  const drafts = readDrafts();

  // Local-only records were seeded against demo event ids; re-point them by slug.
  const remoteIdBySlug = new Map(events.map((event) => [event.slug, event.id]));
  const localSlugById = new Map(local.events.map((event) => [event.id, event.slug]));
  const remap = (id: string) => remoteIdBySlug.get(localSlugById.get(id) ?? "") ?? id;

  return {
    ...local,
    venues,
    events,
    speakers,
    sessions,
    ticketTypes,
    milestones,
    settings,
    registrations: unique([...registrations, ...drafts.registrations]),
    payments: unique([...payments, ...drafts.payments]),
    attendees: unique([...attendees, ...drafts.attendees]),
    checkIns,
    sponsors: local.sponsors.map((sponsor) => ({ ...sponsor, eventIds: sponsor.eventIds.map(remap) })),
    communications: local.communications.map((item) => ({ ...item, eventId: remap(item.eventId) })),
    certificates: local.certificates.map((item) => ({ ...item, eventId: remap(item.eventId) })),
  };
}
