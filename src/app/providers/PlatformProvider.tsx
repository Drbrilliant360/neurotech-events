import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
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
import {
  checkInAttendee,
  connectProfiles,
  createRegistration,
  detectSessionConflicts,
  duplicateEvent,
  issueEligibleCertificates,
  LocalPlatformRepository,
  markAllNotifications,
  markNotification,
  refundPayment,
  saveSettings,
  simulatePayment,
  toggleSavedSession,
  undoCheckIn,
  upsertCommunication,
  upsertEvent,
  upsertMilestone,
  upsertSession,
  upsertSponsor,
  upsertTicket,
} from "../../repositories/platform";

const repo = new LocalPlatformRepository();

interface PlatformContextValue {
  db: PlatformDatabase;
  role: DemoRole;
  attendeeId: string;
  setRole: (role: DemoRole) => void;
  logout: () => void;
  resetDemo: () => void;
  refresh: () => void;
  saveEvent: (input: Partial<Event> & Pick<Event, "title">) => void;
  copyEvent: (eventId: string) => void;
  deleteEvent: (eventId: string) => void;
  saveTicket: (input: Partial<TicketType> & Pick<TicketType, "eventId" | "name" | "price">) => void;
  deleteTicket: (ticketId: string) => void;
  saveSession: (input: Partial<Session> & Pick<Session, "eventId" | "title" | "startTime" | "endTime">) => Session[];
  deleteSession: (sessionId: string) => void;
  register: (input: {
    eventId: string;
    ticketTypeId: string;
    attendee: Omit<Attendee, "id" | "isDemoUser">;
  }) => { registration: Registration; payment: Payment };
  pay: (paymentId: string, method: PaymentMethod, outcome: Extract<PaymentStatus, "paid" | "failed" | "cancelled">) => void;
  refund: (paymentId: string) => void;
  toggleAgenda: (sessionId: string) => void;
  toggleConnect: (toAttendeeId: string) => void;
  readOne: (id: string) => void;
  readAll: () => void;
  checkIn: (query: string) => { message: string; duplicate?: boolean };
  undoScan: (id: string) => void;
  saveSponsor: (input: Partial<Sponsor> & Pick<Sponsor, "name">) => void;
  deleteSponsor: (id: string) => void;
  saveComms: (input: Partial<Communication> & Pick<Communication, "eventId" | "body">) => void;
  saveMilestone: (input: Partial<TimelineMilestone> & Pick<TimelineMilestone, "eventId" | "title" | "date">) => void;
  updateSettings: (settings: OrganizationSettings) => void;
  issueCerts: () => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

function readRole(): DemoRole {
  const value = sessionStorage.getItem(DEMO_ROLE_KEY);
  if (value === "attendee" || value === "admin" || value === "visitor") return value;
  return "visitor";
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<PlatformDatabase>(() => repo.get());
  const [role, setRoleState] = useState<DemoRole>(readRole);
  const attendeeId = sessionStorage.getItem(DEMO_ATTENDEE_KEY) || DEMO_ATTENDEE_ID;

  const apply = useCallback((next: PlatformDatabase) => {
    setDb(repo.commit(next));
  }, []);

  const setRole = useCallback((next: DemoRole) => {
    sessionStorage.setItem(DEMO_ROLE_KEY, next);
    sessionStorage.setItem(DEMO_ATTENDEE_KEY, DEMO_ATTENDEE_ID);
    setRoleState(next);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(DEMO_ROLE_KEY);
    sessionStorage.removeItem(DEMO_ATTENDEE_KEY);
    setRoleState("visitor");
  }, []);

  const value = useMemo<PlatformContextValue>(
    () => ({
      db,
      role,
      attendeeId,
      setRole,
      logout,
      resetDemo: () => setDb(repo.reset()),
      refresh: () => setDb(repo.get()),
      saveEvent: (input) => apply(upsertEvent(repo.clone(), input)),
      copyEvent: (eventId) => apply(duplicateEvent(repo.clone(), eventId)),
      deleteEvent: (eventId) => {
        const next = repo.clone();
        next.events = next.events.filter((item) => item.id !== eventId);
        apply(next);
      },
      saveTicket: (input) => apply(upsertTicket(repo.clone(), input)),
      deleteTicket: (ticketId) => {
        const next = repo.clone();
        next.ticketTypes = next.ticketTypes.filter((item) => item.id !== ticketId);
        apply(next);
      },
      saveSession: (input) => {
        const next = repo.clone();
        upsertSession(next, input);
        const candidate = next.sessions.find((item) => item.title === input.title && item.startTime === input.startTime) ?? next.sessions[0];
        const conflicts = detectSessionConflicts(next.sessions, { ...candidate, ...input, id: input.id ?? candidate.id });
        apply(next);
        return conflicts;
      },
      deleteSession: (sessionId) => {
        const next = repo.clone();
        next.sessions = next.sessions.filter((item) => item.id !== sessionId);
        apply(next);
      },
      register: (input) => {
        const result = createRegistration(repo.clone(), input);
        apply(result.db);
        return result;
      },
      pay: (paymentId, method, outcome) => apply(simulatePayment(repo.clone(), paymentId, method, outcome)),
      refund: (paymentId) => apply(refundPayment(repo.clone(), paymentId)),
      toggleAgenda: (sessionId) => apply(toggleSavedSession(repo.clone(), attendeeId, sessionId)),
      toggleConnect: (toAttendeeId) => apply(connectProfiles(repo.clone(), attendeeId, toAttendeeId)),
      readOne: (id) => apply(markNotification(repo.clone(), id, true)),
      readAll: () => apply(markAllNotifications(repo.clone(), attendeeId)),
      checkIn: (query) => {
        const result = checkInAttendee(repo.clone(), query);
        apply(result.db);
        return { message: result.message, duplicate: result.duplicate };
      },
      undoScan: (id) => apply(undoCheckIn(repo.clone(), id)),
      saveSponsor: (input) => apply(upsertSponsor(repo.clone(), input)),
      deleteSponsor: (id) => {
        const next = repo.clone();
        next.sponsors = next.sponsors.filter((item) => item.id !== id);
        apply(next);
      },
      saveComms: (input) => apply(upsertCommunication(repo.clone(), input)),
      saveMilestone: (input) => apply(upsertMilestone(repo.clone(), input)),
      updateSettings: (settings) => apply(saveSettings(repo.clone(), settings)),
      issueCerts: () => apply(issueEligibleCertificates(repo.clone())),
    }),
    [apply, attendeeId, db, logout, role, setRole],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within PlatformProvider");
  return ctx;
}
