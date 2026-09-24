import type {
  AppNotification,
  Attendee,
  Certificate,
  CheckIn,
  Communication,
  Connection,
  Event,
  NetworkingProfile,
  OrganizationSettings,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PlatformDatabase,
  Registration,
  SavedSession,
  Session,
  Speaker,
  Sponsor,
  TicketType,
  TimelineMilestone,
} from "../domain/types";
import { certificateCode, createId, paymentReference, slugify, ticketNumber } from "../lib/ids";
import { computeVat } from "../lib/money";
import { sessionsOverlap } from "../lib/dates";
import { loadDatabase, resetDatabase, saveDatabase } from "./local/db";

export class LocalPlatformRepository {
  get(): PlatformDatabase {
    return loadDatabase();
  }

  commit(next: PlatformDatabase): PlatformDatabase {
    saveDatabase(next);
    return next;
  }

  reset(): PlatformDatabase {
    return resetDatabase();
  }

  clone(): PlatformDatabase {
    return structuredClone(this.get());
  }
}

export function publicEvents(db: PlatformDatabase): Event[] {
  return db.events.filter((event) => event.status !== "draft");
}

export function eventBySlug(db: PlatformDatabase, slug: string): Event | undefined {
  return db.events.find((event) => event.slug === slug || event.id === slug);
}

export function venueOf(db: PlatformDatabase, venueId: string) {
  return db.venues.find((venue) => venue.id === venueId);
}

export function ticketsFor(db: PlatformDatabase, eventId: string): TicketType[] {
  return db.ticketTypes.filter((ticket) => ticket.eventId === eventId);
}

export function sessionsFor(db: PlatformDatabase, eventId: string): Session[] {
  return db.sessions
    .filter((session) => session.eventId === eventId)
    .sort((a, b) => a.dayIndex - b.dayIndex || a.startTime.localeCompare(b.startTime));
}

export function speakersForEvent(db: PlatformDatabase, eventId: string): Speaker[] {
  const ids = new Set(
    sessionsFor(db, eventId)
      .map((session) => session.speakerId)
      .filter((id): id is string => Boolean(id)),
  );
  return db.speakers.filter((speaker) => ids.has(speaker.id));
}

export function sponsorsForEvent(db: PlatformDatabase, eventId: string): Sponsor[] {
  return db.sponsors.filter((sponsor) => sponsor.active && sponsor.eventIds.includes(eventId));
}

export function registrationBundle(db: PlatformDatabase, registrationId: string) {
  const registration = db.registrations.find((item) => item.id === registrationId);
  if (!registration) return undefined;
  const attendee = db.attendees.find((item) => item.id === registration.attendeeId);
  const event = db.events.find((item) => item.id === registration.eventId);
  const ticket = db.ticketTypes.find((item) => item.id === registration.ticketTypeId);
  const payment = db.payments.find((item) => item.registrationId === registration.id);
  const checkIn = db.checkIns.find((item) => item.registrationId === registration.id && !item.undone);
  if (!attendee || !event || !ticket) return undefined;
  return { registration, attendee, event, ticket, payment, checkIn };
}

export function nextTicketNumber(db: PlatformDatabase): string {
  const nums = db.registrations.map((item) => Number(item.ticketNumber.replace(/\D/g, "")) || 0);
  return ticketNumber(Math.max(0, ...nums) + 1);
}

export function nextPaymentRef(db: PlatformDatabase): string {
  const nums = db.payments.map((item) => Number(item.reference.replace(/\D/g, "")) || 0);
  return paymentReference(Math.max(0, ...nums) + 1 - 90000);
}

export function quoteTotals(price: number, vatPercent: number) {
  const vat = computeVat(price, vatPercent);
  return { subtotal: price, vat, total: price + vat };
}

export function detectSessionConflicts(sessions: Session[], candidate: Session): Session[] {
  return sessions.filter(
    (session) =>
      session.id !== candidate.id &&
      session.eventId === candidate.eventId &&
      (session.room === candidate.room || session.speakerId === candidate.speakerId) &&
      sessionsOverlap(session, candidate),
  );
}

export function upsertEvent(db: PlatformDatabase, input: Partial<Event> & Pick<Event, "title">): PlatformDatabase {
  const now = new Date().toISOString();
  if (input.id) {
    db.events = db.events.map((event) => (event.id === input.id ? { ...event, ...input } : event));
    return db;
  }
  const event: Event = {
    id: createId("evt"),
    slug: input.slug || slugify(input.title),
    title: input.title,
    subtitle: input.subtitle ?? "",
    description: input.description ?? "",
    theme: input.theme ?? "",
    category: input.category ?? "Summit",
    status: input.status ?? "draft",
    format: input.format ?? "physical",
    startsAt: input.startsAt ?? now,
    endsAt: input.endsAt ?? now,
    venueId: input.venueId ?? db.venues[0].id,
    capacity: input.capacity ?? 100,
    registrationOpensAt: input.registrationOpensAt ?? now,
    registrationClosesAt: input.registrationClosesAt ?? now,
    featured: input.featured ?? false,
    bannerLabel: input.bannerLabel ?? input.category ?? "Event",
    highlights: input.highlights ?? [],
    faqs: input.faqs ?? [],
  };
  db.events.unshift(event);
  return db;
}

export function duplicateEvent(db: PlatformDatabase, eventId: string): PlatformDatabase {
  const source = db.events.find((event) => event.id === eventId);
  if (!source) return db;
  const copy: Event = {
    ...source,
    id: createId("evt"),
    slug: `${source.slug}-copy`,
    title: `${source.title} (copy)`,
    status: "draft",
    featured: false,
  };
  db.events.unshift(copy);
  for (const ticket of db.ticketTypes.filter((item) => item.eventId === eventId)) {
    db.ticketTypes.push({ ...ticket, id: createId("tix"), eventId: copy.id, sold: 0 });
  }
  return db;
}

export function upsertTicket(db: PlatformDatabase, input: Partial<TicketType> & Pick<TicketType, "eventId" | "name" | "price">): PlatformDatabase {
  if (input.id) {
    db.ticketTypes = db.ticketTypes.map((ticket) => (ticket.id === input.id ? { ...ticket, ...input } : ticket));
    return db;
  }
  db.ticketTypes.push({
    id: createId("tix"),
    eventId: input.eventId,
    name: input.name,
    tier: input.tier ?? "professional",
    price: input.price,
    currency: input.currency ?? "TZS",
    perks: input.perks ?? "",
    capacity: input.capacity ?? 100,
    sold: 0,
    active: input.active ?? true,
  });
  return db;
}

export function upsertSession(db: PlatformDatabase, input: Partial<Session> & Pick<Session, "eventId" | "title" | "startTime" | "endTime">): PlatformDatabase {
  const speaker = db.speakers.find((item) => item.id === input.speakerId);
  const session: Session = {
    id: input.id ?? createId("ses"),
    eventId: input.eventId,
    title: input.title,
    dayIndex: input.dayIndex ?? 0,
    dayLabel: input.dayLabel ?? `Day ${(input.dayIndex ?? 0) + 1}`,
    date: input.date ?? "",
    startTime: input.startTime,
    endTime: input.endTime,
    speakerId: input.speakerId,
    speakerLabel: input.speakerLabel ?? speaker?.name ?? "TBA",
    room: input.room ?? "Main Hall",
    type: input.type ?? "session",
    description: input.description ?? input.title,
  };
  if (input.id) {
    db.sessions = db.sessions.map((item) => (item.id === input.id ? session : item));
  } else {
    db.sessions.push(session);
  }
  return db;
}

export function createRegistration(
  db: PlatformDatabase,
  input: {
    eventId: string;
    ticketTypeId: string;
    attendee: Omit<Attendee, "id" | "isDemoUser">;
  },
): { db: PlatformDatabase; registration: Registration; payment: Payment } {
  const ticket = db.ticketTypes.find((item) => item.id === input.ticketTypeId);
  if (!ticket || !ticket.active) throw new Error("Ticket is not available.");
  if (ticket.sold >= ticket.capacity) throw new Error("This ticket type is sold out.");

  const existing = db.attendees.find((item) => item.email.toLowerCase() === input.attendee.email.toLowerCase());
  const attendee: Attendee = existing
    ? { ...existing, ...input.attendee }
    : { ...input.attendee, id: createId("att"), isDemoUser: false };
  if (existing) {
    db.attendees = db.attendees.map((item) => (item.id === existing.id ? attendee : item));
  } else {
    db.attendees.push(attendee);
    db.networkingProfiles.push({
      id: createId("net"),
      attendeeId: attendee.id,
      publicName: attendee.fullName,
      initials: attendee.fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      jobTitle: attendee.jobTitle,
      organization: attendee.organization,
      interests: attendee.interests,
      bio: `${attendee.jobTitle} at ${attendee.organization}`,
    });
  }

  const duplicate = db.registrations.find(
    (item) =>
      item.eventId === input.eventId &&
      item.attendeeId === attendee.id &&
      item.status !== "cancelled",
  );
  if (duplicate) throw new Error("You already have a registration for this event.");

  const { total } = quoteTotals(ticket.price, db.settings.vatPercent);
  const registration: Registration = {
    id: createId("reg"),
    eventId: input.eventId,
    attendeeId: attendee.id,
    ticketTypeId: ticket.id,
    status: "pending",
    ticketNumber: nextTicketNumber(db),
    createdAt: new Date().toISOString(),
    dietary: input.attendee.dietary,
    accessibility: input.attendee.accessibility,
  };
  const payment: Payment = {
    id: createId("pay"),
    registrationId: registration.id,
    attendeeId: attendee.id,
    eventId: input.eventId,
    reference: nextPaymentRef(db),
    amount: total,
    currency: ticket.currency,
    method: "mpesa",
    status: ticket.price === 0 ? "paid" : "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (ticket.price === 0) registration.status = "confirmed";
  ticket.sold += 1;
  db.registrations.unshift(registration);
  db.payments.unshift(payment);
  pushNotification(db, attendee.id, "Registration started", `Ticket ${registration.ticketNumber} is reserved.`, "registration");
  return { db, registration, payment };
}

export function simulatePayment(
  db: PlatformDatabase,
  paymentId: string,
  method: PaymentMethod,
  outcome: Extract<PaymentStatus, "paid" | "failed" | "cancelled">,
): PlatformDatabase {
  const payment = db.payments.find((item) => item.id === paymentId);
  if (!payment) return db;
  payment.method = method;
  payment.status = outcome === "paid" ? "processing" : outcome;
  payment.updatedAt = new Date().toISOString();
  const registration = db.registrations.find((item) => item.id === payment.registrationId);
  if (outcome === "paid") {
    payment.status = "paid";
    if (registration) {
      if (registration.status === "cancelled") {
        const ticket = db.ticketTypes.find((item) => item.id === registration.ticketTypeId);
        if (ticket && ticket.sold < ticket.capacity) ticket.sold += 1;
      }
      registration.status = "confirmed";
    }
    pushNotification(db, payment.attendeeId, "Payment successfully received", `${payment.reference} · ${payment.method}`, "payment");
    pushNotification(db, payment.attendeeId, "Registration confirmed", "Your ticket is ready in My ticket.", "registration");
  }
  if (outcome === "failed") {
    pushNotification(db, payment.attendeeId, "Payment not completed", "You can retry checkout from your registration.", "payment");
  }
  if (outcome === "cancelled") {
    if (registration?.status !== "cancelled") {
      if (registration) registration.status = "cancelled";
      const ticket = db.ticketTypes.find((item) => item.id === registration?.ticketTypeId);
      if (ticket && ticket.sold > 0) ticket.sold -= 1;
    }
  }
  return db;
}

export interface RemotePaymentLink {
  providerPaymentId: string;
  reference: string;
  providerReference?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount?: number;
}

/** Attach the server-side payment created by the API to the local checkout record. */
export function linkRemotePayment(db: PlatformDatabase, paymentId: string, remote: RemotePaymentLink): PlatformDatabase {
  const payment = db.payments.find((item) => item.id === paymentId);
  if (!payment) return db;
  payment.provider = "snippe";
  payment.providerPaymentId = remote.providerPaymentId;
  payment.providerReference = remote.providerReference;
  payment.reference = remote.reference;
  payment.method = remote.method;
  if (typeof remote.amount === "number") payment.amount = remote.amount;
  payment.status = remote.status === "paid" ? "processing" : remote.status;
  payment.updatedAt = new Date().toISOString();
  return db;
}

export function refundPayment(db: PlatformDatabase, paymentId: string): PlatformDatabase {
  const payment = db.payments.find((item) => item.id === paymentId);
  if (!payment || payment.status !== "paid") return db;
  payment.status = "refunded";
  payment.updatedAt = new Date().toISOString();
  const registration = db.registrations.find((item) => item.id === payment.registrationId);
  if (registration) registration.status = "cancelled";
  return db;
}

function initialsOf(name: string): string {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export type AttendeePatch = Partial<Pick<Attendee, "fullName" | "phone" | "organization" | "jobTitle" | "country" | "roleTitle" | "interests">>;

/** Update an attendee and keep their networking card in step. */
export function updateAttendee(db: PlatformDatabase, attendeeId: string, patch: AttendeePatch): PlatformDatabase {
  const attendee = db.attendees.find((item) => item.id === attendeeId);
  if (!attendee) return db;
  Object.assign(attendee, patch);
  const profile = db.networkingProfiles.find((item) => item.attendeeId === attendeeId);
  if (profile) {
    profile.publicName = attendee.fullName;
    profile.initials = initialsOf(attendee.fullName);
    profile.jobTitle = attendee.jobTitle;
    profile.organization = attendee.organization;
    profile.interests = attendee.interests;
  }
  return db;
}

export interface AttendeeInput {
  email: string;
  fullName: string;
  phone?: string;
  organization?: string;
  jobTitle?: string;
  country?: string;
  interests?: string[];
}

/** Find the attendee with this email or create one (used when someone signs in or creates an account). */
export function ensureAttendee(db: PlatformDatabase, input: AttendeeInput): { db: PlatformDatabase; attendeeId: string } {
  const existing = db.attendees.find((item) => item.email.toLowerCase() === input.email.trim().toLowerCase());
  if (existing) {
    if (input.fullName) existing.fullName = input.fullName;
    if (input.phone) existing.phone = input.phone;
    if (input.organization) existing.organization = input.organization;
    if (input.jobTitle) existing.jobTitle = input.jobTitle;
    if (input.country) existing.country = input.country;
    if (input.interests?.length) existing.interests = input.interests;
    return { db, attendeeId: existing.id };
  }
  const attendee: Attendee = {
    id: createId("att"),
    fullName: input.fullName,
    email: input.email.trim().toLowerCase(),
    phone: input.phone ?? "",
    organization: input.organization ?? "",
    jobTitle: input.jobTitle ?? "",
    country: input.country ?? "Tanzania",
    roleTitle: input.jobTitle ?? "Attendee",
    interests: input.interests ?? [],
    isDemoUser: false,
  };
  db.attendees.push(attendee);
  db.networkingProfiles.push({
    id: createId("net"),
    attendeeId: attendee.id,
    publicName: attendee.fullName,
    initials: initialsOf(attendee.fullName),
    jobTitle: attendee.jobTitle,
    organization: attendee.organization,
    interests: attendee.interests,
    bio: attendee.jobTitle && attendee.organization ? `${attendee.jobTitle} at ${attendee.organization}` : "",
  });
  return { db, attendeeId: attendee.id };
}

export function deleteMilestone(db: PlatformDatabase, id: string): PlatformDatabase {
  db.milestones = db.milestones.filter((item) => item.id !== id);
  return db;
}

export function toggleSavedSession(db: PlatformDatabase, attendeeId: string, sessionId: string): PlatformDatabase {
  const exists = db.savedSessions.find((item) => item.attendeeId === attendeeId && item.sessionId === sessionId);
  if (exists) {
    db.savedSessions = db.savedSessions.filter((item) => item !== exists);
  } else {
    db.savedSessions.push({ attendeeId, sessionId } satisfies SavedSession);
  }
  return db;
}

export function connectProfiles(db: PlatformDatabase, fromAttendeeId: string, toAttendeeId: string): PlatformDatabase {
  const exists = db.connections.find(
    (item) =>
      (item.fromAttendeeId === fromAttendeeId && item.toAttendeeId === toAttendeeId) ||
      (item.fromAttendeeId === toAttendeeId && item.toAttendeeId === fromAttendeeId),
  );
  if (exists) {
    db.connections = db.connections.filter((item) => item.id !== exists.id);
  } else {
    db.connections.push({
      id: createId("con"),
      fromAttendeeId,
      toAttendeeId,
      createdAt: new Date().toISOString(),
    } satisfies Connection);
  }
  return db;
}

export function markNotification(db: PlatformDatabase, id: string, read: boolean): PlatformDatabase {
  db.notifications = db.notifications.map((item) => (item.id === id ? { ...item, read } : item));
  return db;
}

export function markAllNotifications(db: PlatformDatabase, attendeeId: string): PlatformDatabase {
  db.notifications = db.notifications.map((item) => (item.attendeeId === attendeeId ? { ...item, read: true } : item));
  return db;
}

export function checkInAttendee(db: PlatformDatabase, query: string): { db: PlatformDatabase; message: string; duplicate?: boolean } {
  const needle = query.trim().toLowerCase();
  const registration = db.registrations.find(
    (item) =>
      item.ticketNumber.toLowerCase() === needle ||
      db.attendees.find((attendee) => attendee.id === item.attendeeId)?.fullName.toLowerCase().includes(needle) ||
      db.attendees.find((attendee) => attendee.id === item.attendeeId)?.email.toLowerCase() === needle,
  );
  if (!registration) return { db, message: "No matching ticket or attendee." };
  if (registration.status !== "confirmed") return { db, message: "Registration is not confirmed." };
  const existing = db.checkIns.find((item) => item.registrationId === registration.id && !item.undone);
  if (existing) return { db, message: "Already checked in.", duplicate: true };
  db.checkIns.unshift({
    id: createId("cin"),
    registrationId: registration.id,
    attendeeId: registration.attendeeId,
    eventId: registration.eventId,
    ticketNumber: registration.ticketNumber,
    checkedInAt: new Date().toISOString(),
    undone: false,
  } satisfies CheckIn);
  return { db, message: "Checked in." };
}

export function undoCheckIn(db: PlatformDatabase, checkInId: string): PlatformDatabase {
  db.checkIns = db.checkIns.map((item) => (item.id === checkInId ? { ...item, undone: true } : item));
  return db;
}

export function upsertSponsor(db: PlatformDatabase, input: Partial<Sponsor> & Pick<Sponsor, "name">): PlatformDatabase {
  if (input.id) {
    db.sponsors = db.sponsors.map((item) => (item.id === input.id ? { ...item, ...input } : item));
    return db;
  }
  db.sponsors.push({
    id: createId("spo"),
    name: input.name,
    tier: input.tier ?? "partner",
    website: input.website ?? "",
    contact: input.contact ?? "",
    active: input.active ?? true,
    eventIds: input.eventIds ?? [],
  });
  return db;
}

export function upsertCommunication(db: PlatformDatabase, input: Partial<Communication> & Pick<Communication, "eventId" | "body">): PlatformDatabase {
  const record: Communication = {
    id: input.id ?? createId("com"),
    eventId: input.eventId,
    channel: input.channel ?? "email",
    audience: input.audience ?? "all",
    subject: input.subject ?? "Announcement",
    body: input.body,
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? new Date().toISOString(),
    sentAt: input.status === "sent" ? new Date().toISOString() : input.sentAt,
  };
  if (input.id) {
    db.communications = db.communications.map((item) => (item.id === input.id ? record : item));
  } else {
    db.communications.unshift(record);
  }
  if (record.status === "sent") {
    for (const attendee of db.attendees) {
      pushNotification(db, attendee.id, record.subject, record.body, "announcement");
    }
  }
  return db;
}

export function upsertMilestone(db: PlatformDatabase, input: Partial<TimelineMilestone> & Pick<TimelineMilestone, "eventId" | "title" | "date">): PlatformDatabase {
  if (input.id) {
    db.milestones = db.milestones.map((item) => (item.id === input.id ? { ...item, ...input } : item));
    return db;
  }
  db.milestones.push({
    id: createId("ms"),
    eventId: input.eventId,
    title: input.title,
    date: input.date,
    status: input.status ?? "scheduled",
    dayIndex: input.dayIndex,
  });
  return db;
}

export function saveSettings(db: PlatformDatabase, settings: OrganizationSettings): PlatformDatabase {
  db.settings = settings;
  return db;
}

export function issueEligibleCertificates(db: PlatformDatabase): PlatformDatabase {
  const completed = db.events.filter((event) => event.status === "completed");
  for (const event of completed) {
    const confirmed = db.registrations.filter((item) => item.eventId === event.id && item.status === "confirmed");
    for (const registration of confirmed) {
      const checked = db.checkIns.some((item) => item.registrationId === registration.id && !item.undone);
      if (!checked) continue;
      const exists = db.certificates.some((item) => item.eventId === event.id && item.attendeeId === registration.attendeeId);
      if (exists) continue;
      const seq = db.certificates.length + 1;
      db.certificates.push({
        id: createId("cert"),
        attendeeId: registration.attendeeId,
        eventId: event.id,
        certificateId: certificateCode(seq),
        issuedAt: new Date().toISOString(),
      } satisfies Certificate);
      pushNotification(db, registration.attendeeId, "Certificate available", `${event.title} certificate is ready.`, "certificate");
    }
  }
  return db;
}

function pushNotification(
  db: PlatformDatabase,
  attendeeId: string,
  title: string,
  body: string,
  category: AppNotification["category"],
) {
  if (!db.settings.notifyOnRegistration && category === "registration") return;
  if (!db.settings.notifyOnPayment && category === "payment") return;
  db.notifications.unshift({
    id: createId("ntf"),
    attendeeId,
    title,
    body,
    category,
    createdAt: new Date().toISOString(),
    read: false,
  });
}

export type { NetworkingProfile };
