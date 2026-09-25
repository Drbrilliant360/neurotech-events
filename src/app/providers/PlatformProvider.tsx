import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEMO_ATTENDEE_ID } from "../../data/seed/database";
import type {
  Attendee,
  Communication,
  DemoRole,
  Event,
  OrganizationSettings,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PlatformDatabase,
  Registration,
  Session,
  Sponsor,
  TicketType,
  TimelineMilestone,
} from "../../domain/types";
import { DEMO_ATTENDEE_KEY, DEMO_ROLE_KEY } from "../../lib/localStore";
import { createId } from "../../lib/ids";
import { ApiError, isApiEnabled, onSessionExpired } from "../../services/api";
import { fetchMe, hasSession, logoutSession, updateMe, workspaceFor, type AuthUser } from "../../services/auth";
import * as api from "../../services/platformApi";
import type { EventAccessDto } from "../../services/platformApi";
import {
  checkInAttendee,
  connectProfiles,
  createRegistration,
  deleteMilestone,
  detectSessionConflicts,
  ensureAttendee,
  duplicateEvent,
  issueEligibleCertificates,
  linkRemotePayment,
  LocalPlatformRepository,
  markAllNotifications,
  markNotification,
  quoteTotals,
  refundPayment,
  saveSettings,
  simulatePayment,
  toggleSavedSession,
  undoCheckIn,
  updateAttendee,
  upsertCommunication,
  upsertEvent,
  upsertMilestone,
  upsertSession,
  upsertSponsor,
  upsertTicket,
  type AttendeeInput,
  type AttendeePatch,
  type RemotePaymentLink,
} from "../../repositories/platform";
import { buildLiveDatabase, readDrafts, TBA_VENUE_ID, writeDrafts, type LiveSources } from "../../repositories/remote";

const repo = new LocalPlatformRepository();
/** True when the app talks to the Neurotech Events API instead of the in-browser demo store. */
export const LIVE = isApiEnabled();

type RegisterInput = { eventId: string; ticketTypeId: string; attendee: Omit<Attendee, "id" | "isDemoUser"> };
type CheckInResult = { message: string; duplicate?: boolean; ok?: boolean };

interface PlatformContextValue {
  db: PlatformDatabase;
  role: DemoRole;
  attendeeId: string;
  /** Live mode: the signed-in account. */
  user: AuthUser | null;
  live: boolean;
  /** Per-event permissions for the organiser console (live mode). */
  access: Record<string, EventAccessDto>;
  syncing: boolean;
  error: string | null;
  clearError: () => void;
  setRole: (role: DemoRole) => void;
  /** Demo mode: enter a workspace as a specific attendee (defaults to the demo attendee). */
  signIn: (role: DemoRole, attendeeId?: string) => void;
  /** Live mode: open the workspace for an authenticated account. */
  signInWithAccount: (user: AuthUser) => Promise<DemoRole>;
  logout: () => void;
  reload: () => Promise<void>;
  saveProfile: (patch: AttendeePatch) => Promise<boolean>;
  ensureLocalAttendee: (input: AttendeeInput) => string;
  removeMilestone: (id: string) => Promise<boolean>;
  resetDemo: () => void;
  refresh: () => void;
  saveEvent: (input: Partial<Event> & Pick<Event, "title">) => Promise<boolean>;
  copyEvent: (eventId: string) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  saveTicket: (input: Partial<TicketType> & Pick<TicketType, "eventId" | "name" | "price">) => Promise<boolean>;
  deleteTicket: (ticketId: string) => Promise<boolean>;
  saveSession: (input: Partial<Session> & Pick<Session, "eventId" | "title" | "startTime" | "endTime">) => Promise<Session[]>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  register: (input: RegisterInput) => { registration: Registration; payment: Payment };
  /** Live mode: drop a checkout draft once the server has created the real registration. */
  discardDraft: (registrationId: string) => void;
  pay: (paymentId: string, method: PaymentMethod, outcome: Extract<PaymentStatus, "paid" | "failed" | "cancelled">) => void;
  refund: (paymentId: string) => void;
  linkRemote: (paymentId: string, remote: RemotePaymentLink) => void;
  toggleAgenda: (sessionId: string) => void;
  toggleConnect: (toAttendeeId: string) => void;
  readOne: (id: string) => void;
  readAll: () => void;
  checkIn: (query: string) => Promise<CheckInResult>;
  undoScan: (id: string) => Promise<boolean>;
  saveSponsor: (input: Partial<Sponsor> & Pick<Sponsor, "name">) => void;
  deleteSponsor: (id: string) => void;
  saveComms: (input: Partial<Communication> & Pick<Communication, "eventId" | "body">) => void;
  saveMilestone: (input: Partial<TimelineMilestone> & Pick<TimelineMilestone, "eventId" | "title" | "date">) => Promise<boolean>;
  updateSettings: (settings: OrganizationSettings) => Promise<boolean>;
  issueCerts: () => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

function readRole(): DemoRole {
  if (import.meta.env.DEV && !LIVE) {
    // Demo helper: /?as=admin opens a workspace directly for local testing and screenshots.
    const requested = new URLSearchParams(window.location.search).get("as");
    if (requested === "attendee" || requested === "admin" || requested === "visitor") {
      sessionStorage.setItem(DEMO_ROLE_KEY, requested);
      sessionStorage.setItem(DEMO_ATTENDEE_KEY, DEMO_ATTENDEE_ID);
      return requested;
    }
  }
  if (LIVE && !hasSession()) return "visitor";
  const value = sessionStorage.getItem(DEMO_ROLE_KEY);
  if (value === "attendee" || value === "admin" || value === "visitor") return value;
  return "visitor";
}

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Something went wrong.";
}

/** Only the fields that differ, so a PATCH never resends (or accidentally changes) the rest. */
function changed<T extends object>(next: T, current: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (JSON.stringify(next[key]) !== JSON.stringify(current[key])) out[key] = next[key];
  }
  return out;
}

function eventInput(input: Partial<Event>): api.EventInput {
  const optional = (value: string | undefined) => (value === undefined ? undefined : value || null);
  return {
    slug: input.slug || undefined,
    title: input.title,
    subtitle: optional(input.subtitle),
    description: optional(input.description),
    theme: optional(input.theme),
    category: optional(input.category),
    format: input.format,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    capacity: input.capacity,
    registration_opens_at: optional(input.registrationOpensAt),
    registration_closes_at: optional(input.registrationClosesAt),
    featured: input.featured,
    banner_label: optional(input.bannerLabel),
    highlights: input.highlights,
    faqs: input.faqs,
    venue_id: input.venueId === undefined ? undefined : input.venueId === TBA_VENUE_ID ? null : input.venueId,
  };
}

function strip<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150) || `event-${Date.now()}`;
}

function sessionDate(event: Event | undefined, dayIndex: number): string {
  const start = event ? new Date(event.startsAt) : new Date();
  start.setDate(start.getDate() + dayIndex);
  return start.toISOString().slice(0, 10);
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<PlatformDatabase>(() => repo.get());
  const [role, setRoleState] = useState<DemoRole>(readRole);
  const [demoAttendeeId, setDemoAttendeeId] = useState<string>(() => sessionStorage.getItem(DEMO_ATTENDEE_KEY) || DEMO_ATTENDEE_ID);
  const [sources, setSources] = useState<LiveSources | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!LIVE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftTick, setDraftTick] = useState(0);
  const roleRef = useRef(role);
  roleRef.current = role;

  const db = useMemo(
    () => (LIVE && sources ? buildLiveDatabase(local, sources) : local),
    // draftTick re-reads checkout drafts from session storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [local, sources, draftTick],
  );
  const access = useMemo(
    () => Object.fromEntries((sources?.workspace?.access ?? []).map((item) => [item.event_id, item])),
    [sources],
  );
  const attendeeId = LIVE ? (user?.attendee_id ?? "") : demoAttendeeId;

  const applyLocal = useCallback((next: PlatformDatabase) => setLocal(repo.commit(next)), []);

  const load = useCallback(async (forRole: DemoRole, account: AuthUser | null, catalogueRequest?: Promise<api.CatalogueDto>) => {
    // Independent requests run in parallel: each one is a network round trip to the API.
    const [catalogue, workspace, myRegistrations] = await Promise.all([
      catalogueRequest ?? api.fetchCatalogue(),
      account && forRole === "admin" ? api.fetchWorkspace() : Promise.resolve(undefined),
      account && forRole === "attendee" ? api.fetchMyRegistrations() : Promise.resolve(undefined),
    ]);
    setSources({ catalogue, user: account ?? undefined, workspace, myRegistrations });
  }, []);

  const reload = useCallback(async () => {
    if (!LIVE) {
      setLocal(repo.get());
      return;
    }
    setSyncing(true);
    try {
      await load(roleRef.current, user);
    } catch (err) {
      setError(message(err));
    } finally {
      setSyncing(false);
    }
  }, [load, user]);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(DEMO_ROLE_KEY);
    sessionStorage.removeItem(DEMO_ATTENDEE_KEY);
    setDemoAttendeeId(DEMO_ATTENDEE_ID);
    setUser(null);
    setRoleState("visitor");
  }, []);

  // Live start-up: restore the session (if any) and hydrate from the API.
  useEffect(() => {
    if (!LIVE) return;
    let cancelled = false;
    (async () => {
      try {
        let account: AuthUser | null = null;
        let startRole: DemoRole = "visitor";
        // Start the public catalogue while the session is being restored.
        const catalogueRequest = api.fetchCatalogue();
        if (hasSession()) {
          try {
            account = await fetchMe();
            startRole = workspaceFor(account);
          } catch {
            await logoutSession();
          }
        }
        if (cancelled) return;
        setUser(account);
        setRoleState(startRole);
        await load(startRole, account, catalogueRequest);
        if (!cancelled) {
          setLoadError(null);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setLoadError(message(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => onSessionExpired(() => {
    clearSession();
    setError("Your session has expired. Please sign in again.");
  }), [clearSession]);

  const signIn = useCallback((next: DemoRole, nextAttendeeId: string = DEMO_ATTENDEE_ID) => {
    sessionStorage.setItem(DEMO_ROLE_KEY, next);
    sessionStorage.setItem(DEMO_ATTENDEE_KEY, nextAttendeeId);
    setDemoAttendeeId(nextAttendeeId);
    setRoleState(next);
  }, []);

  const signInWithAccount = useCallback(async (account: AuthUser) => {
    const next = workspaceFor(account);
    sessionStorage.setItem(DEMO_ROLE_KEY, next);
    setUser(account);
    setRoleState(next);
    setSyncing(true);
    try {
      await load(next, account);
    } catch (err) {
      setError(message(err));
    } finally {
      setSyncing(false);
    }
    return next;
  }, [load]);

  const setRole = useCallback((next: DemoRole) => signIn(next), [signIn]);

  const logout = useCallback(() => {
    clearSession();
    if (LIVE) {
      void logoutSession();
      void load("visitor", null).catch((err) => setError(message(err)));
    }
  }, [clearSession, load]);

  /** Run a server mutation, then re-read the server state. Errors surface in the banner. */
  const mutate = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setSyncing(true);
    setError(null);
    try {
      await action();
      await load(roleRef.current, user);
      return true;
    } catch (err) {
      setError(message(err));
      return false;
    } finally {
      setSyncing(false);
    }
  }, [load, user]);

  const value = useMemo<PlatformContextValue>(() => {
    const eventOf = (id: string) => db.events.find((item) => item.id === id);
    const localOnly = {
      toggleAgenda: (sessionId: string) => applyLocal(toggleSavedSession(repo.clone(), attendeeId, sessionId)),
      toggleConnect: (toAttendeeId: string) => applyLocal(connectProfiles(repo.clone(), attendeeId, toAttendeeId)),
      readOne: (id: string) => applyLocal(markNotification(repo.clone(), id, true)),
      readAll: () => applyLocal(markAllNotifications(repo.clone(), attendeeId)),
      saveSponsor: (input: Partial<Sponsor> & Pick<Sponsor, "name">) => applyLocal(upsertSponsor(repo.clone(), input)),
      deleteSponsor: (id: string) => {
        const next = repo.clone();
        next.sponsors = next.sponsors.filter((item) => item.id !== id);
        applyLocal(next);
      },
      saveComms: (input: Partial<Communication> & Pick<Communication, "eventId" | "body">) => applyLocal(upsertCommunication(repo.clone(), input)),
      issueCerts: () => applyLocal(issueEligibleCertificates(repo.clone())),
      resetDemo: () => setLocal(repo.reset()),
      refresh: () => (LIVE ? void reload() : setLocal(repo.get())),
      ensureLocalAttendee: (input: AttendeeInput) => {
        const result = ensureAttendee(repo.clone(), input);
        applyLocal(result.db);
        return result.attendeeId;
      },
    };

    const shared = {
      db, role, attendeeId, user, live: LIVE, access, syncing, error,
      clearError: () => setError(null), setRole, signIn, signInWithAccount, logout, reload, ...localOnly,
    };

    if (!LIVE) {
      const done = <T,>(result: T) => Promise.resolve(result);
      return {
        ...shared,
        saveProfile: (patch) => { applyLocal(updateAttendee(repo.clone(), attendeeId, patch)); return done(true); },
        removeMilestone: (id) => { applyLocal(deleteMilestone(repo.clone(), id)); return done(true); },
        saveEvent: (input) => { applyLocal(upsertEvent(repo.clone(), input)); return done(true); },
        copyEvent: (eventId) => { applyLocal(duplicateEvent(repo.clone(), eventId)); return done(true); },
        deleteEvent: (eventId) => {
          const next = repo.clone();
          next.events = next.events.filter((item) => item.id !== eventId);
          applyLocal(next);
          return done(true);
        },
        saveTicket: (input) => { applyLocal(upsertTicket(repo.clone(), input)); return done(true); },
        deleteTicket: (ticketId) => {
          const next = repo.clone();
          next.ticketTypes = next.ticketTypes.filter((item) => item.id !== ticketId);
          applyLocal(next);
          return done(true);
        },
        saveSession: (input) => {
          const next = repo.clone();
          upsertSession(next, input);
          const candidate = next.sessions.find((item) => item.title === input.title && item.startTime === input.startTime) ?? next.sessions[0];
          const conflicts = detectSessionConflicts(next.sessions, { ...candidate, ...input, id: input.id ?? candidate.id });
          applyLocal(next);
          return done(conflicts);
        },
        deleteSession: (sessionId) => {
          const next = repo.clone();
          next.sessions = next.sessions.filter((item) => item.id !== sessionId);
          applyLocal(next);
          return done(true);
        },
        register: (input) => {
          const result = createRegistration(repo.clone(), input);
          applyLocal(result.db);
          return result;
        },
        discardDraft: () => undefined,
        pay: (paymentId, method, outcome) => applyLocal(simulatePayment(repo.clone(), paymentId, method, outcome)),
        refund: (paymentId) => applyLocal(refundPayment(repo.clone(), paymentId)),
        linkRemote: (paymentId, remote) => applyLocal(linkRemotePayment(repo.clone(), paymentId, remote)),
        checkIn: (query) => {
          const result = checkInAttendee(repo.clone(), query);
          applyLocal(result.db);
          return done({ message: result.message, duplicate: result.duplicate, ok: result.message === "Checked in." });
        },
        undoScan: (id) => { applyLocal(undoCheckIn(repo.clone(), id)); return done(true); },
        saveMilestone: (input) => { applyLocal(upsertMilestone(repo.clone(), input)); return done(true); },
        updateSettings: (settings) => { applyLocal(saveSettings(repo.clone(), settings)); return done(true); },
      };
    }

    // ------------------------------------------------------------- live mode
    const organizationId = sources?.workspace?.organizations[0]?.id;
    return {
      ...shared,
      saveProfile: (patch) => mutate(() => updateMe({
        full_name: patch.fullName,
        phone: patch.phone,
        organization: patch.organization,
        job_title: patch.jobTitle,
        country: patch.country,
        interests: patch.interests ?? [],
      }).then(setUser)),
      saveEvent: (input) => mutate(async () => {
        const current = input.id ? eventOf(input.id) : undefined;
        if (!current) {
          await api.createEvent(strip({ ...eventInput(input), slug: input.slug || slugify(input.title), organization_id: organizationId }));
          return;
        }
        const { status, ...rest } = input;
        const diff = strip(changed(eventInput({ ...current, ...rest }), eventInput(current)));
        if (Object.keys(diff).length) await api.updateEvent(current.id, diff);
        if (status && status !== current.status) await api.changeEventStatus(current.id, status);
      }),
      copyEvent: (eventId) => mutate(() => api.duplicateEvent(eventId)),
      deleteEvent: (eventId) => mutate(() => api.deleteEvent(eventId)),
      saveTicket: (input) => mutate(async () => {
        const fields = { name: input.name, tier: input.tier, price: input.price, capacity: input.capacity, perks: input.perks, active: input.active };
        const current = input.id ? db.ticketTypes.find((item) => item.id === input.id) : undefined;
        if (!current) {
          await api.createTicketType(input.eventId, strip({ ...fields, tier: input.tier ?? "professional", capacity: input.capacity ?? 100 }));
          return;
        }
        const diff = strip(changed(fields, { name: current.name, tier: current.tier, price: current.price, capacity: current.capacity, perks: current.perks, active: current.active }));
        if (Object.keys(diff).length) await api.updateTicketType(current.eventId, current.id, diff);
      }),
      deleteTicket: (ticketId) => mutate(async () => {
        const ticket = db.ticketTypes.find((item) => item.id === ticketId);
        if (ticket) await api.deleteTicketType(ticket.eventId, ticket.id);
      }),
      saveSession: async (input) => {
        const event = eventOf(input.eventId);
        const body = strip({
          title: input.title,
          session_date: input.date || sessionDate(event, input.dayIndex ?? 0),
          start_time: input.startTime,
          end_time: input.endTime,
          day_label: input.dayLabel,
          room: input.room,
          session_type: input.type,
          description: input.description,
          speaker_id: input.speakerId || null,
        });
        const conflicts = detectSessionConflicts(db.sessions, {
          id: input.id ?? "new", dayIndex: input.dayIndex ?? 0, dayLabel: "", date: body.session_date ?? "", speakerLabel: "",
          room: input.room ?? "", type: input.type ?? "session", description: "", ...input,
        } as Session);
        const ok = await mutate(() => (input.id ? api.updateSession(input.eventId, input.id, body) : api.createSession(input.eventId, body)));
        return ok ? conflicts : [];
      },
      deleteSession: (sessionId) => mutate(async () => {
        const session = db.sessions.find((item) => item.id === sessionId);
        if (session) await api.deleteSession(session.eventId, session.id);
      }),
      register: (input) => {
        // Live checkout: keep the form as a browser-side draft. The server creates the real
        // registration when payment starts (or when a free ticket is confirmed).
        const ticket = db.ticketTypes.find((item) => item.id === input.ticketTypeId);
        if (!ticket || !ticket.active) throw new Error("Ticket is not available.");
        if (ticket.sold >= ticket.capacity) throw new Error("This ticket type is sold out.");
        const now = new Date().toISOString();
        const attendee: Attendee = { ...input.attendee, id: createId("draft-att"), isDemoUser: false };
        const registration: Registration = {
          id: createId("draft-reg"), eventId: input.eventId, attendeeId: attendee.id, ticketTypeId: ticket.id,
          status: "pending", ticketNumber: "Pending payment", createdAt: now,
          dietary: input.attendee.dietary, accessibility: input.attendee.accessibility,
        };
        const payment: Payment = {
          id: createId("draft-pay"), registrationId: registration.id, attendeeId: attendee.id, eventId: input.eventId,
          reference: "—", amount: quoteTotals(ticket.price, db.settings.vatPercent).total, currency: ticket.currency,
          method: "mpesa", status: "pending", createdAt: now, updatedAt: now,
        };
        const drafts = readDrafts();
        writeDrafts({
          registrations: [...drafts.registrations, registration],
          payments: [...drafts.payments, payment],
          attendees: [...drafts.attendees, attendee],
        });
        setDraftTick((tick) => tick + 1);
        return { registration, payment };
      },
      discardDraft: (registrationId) => {
        const drafts = readDrafts();
        const reg = drafts.registrations.find((item) => item.id === registrationId);
        writeDrafts({
          registrations: drafts.registrations.filter((item) => item.id !== registrationId),
          payments: drafts.payments.filter((item) => item.registrationId !== registrationId),
          attendees: drafts.attendees.filter((item) => item.id !== reg?.attendeeId),
        });
        setDraftTick((tick) => tick + 1);
      },
      // Payment state is owned by the server and the provider; nothing to simulate locally.
      pay: () => undefined,
      linkRemote: () => undefined,
      refund: () => setError("Refunds are issued from the Snippe dashboard; they are not yet automated here."),
      checkIn: async (query) => {
        const needle = query.trim();
        if (!needle) return { message: "Enter a ticket number, QR code, name or email." };
        const lower = needle.toLowerCase();
        const match = db.registrations.find((item) => {
          const attendee = db.attendees.find((person) => person.id === item.attendeeId);
          return item.ticketNumber.toLowerCase() === lower || attendee?.email.toLowerCase() === lower || attendee?.fullName.toLowerCase().includes(lower);
        });
        const code = match?.ticketNumber ?? needle;
        const candidates = match ? [match.eventId] : Object.values(access).filter((item) => item.can_check_in).map((item) => item.event_id);
        let last = "No matching ticket or attendee.";
        for (const eventId of candidates) {
          try {
            const result = await api.checkInTicket(eventId, code);
            await load(roleRef.current, user).catch(() => undefined);
            return { message: `Checked in ${result.attendee_name} · ${result.ticket_name}.`, ok: true };
          } catch (err) {
            if (err instanceof ApiError && err.code === "already_checked_in") return { message: err.message, duplicate: true };
            if (err instanceof ApiError && (err.status === 404 || err.code === "wrong_event")) {
              last = err.message;
              continue;
            }
            return { message: message(err) };
          }
        }
        return { message: last };
      },
      undoScan: (id) => mutate(async () => {
        const record = db.checkIns.find((item) => item.id === id);
        if (record) await api.undoCheckIn(record.eventId, record.id);
      }),
      saveMilestone: (input) => mutate(() => {
        const body = strip({ title: input.title, milestone_date: input.date, status: input.status, day_index: input.dayIndex ?? null });
        return input.id ? api.updateMilestone(input.eventId, input.id, body) : api.createMilestone(input.eventId, body);
      }),
      removeMilestone: (id) => mutate(async () => {
        const milestone = db.milestones.find((item) => item.id === id);
        if (milestone) await api.deleteMilestone(milestone.eventId, milestone.id);
      }),
      updateSettings: (settings) => mutate(async () => {
        if (!organizationId) throw new Error("You do not manage an organization.");
        await api.updateOrganization(organizationId, {
          name: settings.organizationName,
          brand_name: settings.brandName,
          contact_email: settings.contactEmail,
          contact_phone: settings.contactPhone || null,
          default_currency: settings.defaultCurrency,
          default_city: settings.defaultCity || null,
          default_country: settings.defaultCountry || null,
          vat_percent: settings.vatPercent,
          registration_open_by_default: settings.registrationOpenByDefault,
          notify_on_registration: settings.notifyOnRegistration,
          notify_on_payment: settings.notifyOnPayment,
        });
      }),
    };
  }, [access, applyLocal, attendeeId, db, error, load, logout, mutate, reload, role, setRole, signIn, signInWithAccount, sources, syncing, user]);

  if (!ready) {
    return (
      <div className="nt-container" style={{ padding: "96px 24px", textAlign: "center" }} role="status" aria-live="polite">
        {loadError ? (
          <>
            <h1>We couldn’t reach Neurotech Events</h1>
            <p className="nt-muted">{loadError}</p>
            <button type="button" className="nt-btn" onClick={() => window.location.reload()}>Try again</button>
          </>
        ) : (
          <p className="nt-muted">Loading events…</p>
        )}
      </div>
    );
  }

  return (
    <PlatformContext.Provider value={value}>
      {children}
      {error ? (
        <div role="alert" className="nt-live-toast" style={{
          position: "fixed", right: 16, bottom: 16, left: 16, maxWidth: 520, marginLeft: "auto", zIndex: 1000,
          background: "#3b1111", color: "#fff", padding: "12px 16px", borderRadius: 12, display: "flex", gap: 12, alignItems: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" className="nt-chip" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within PlatformProvider");
  return ctx;
}
