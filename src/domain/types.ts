export type EventStatus =
  | "draft"
  | "published"
  | "ongoing"
  | "completed"
  | "cancelled";

export type EventFormat = "physical" | "online" | "hybrid";

export type RegistrationStatus = "pending" | "confirmed" | "cancelled";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentMethod =
  | "mpesa"
  | "airtel"
  | "mixx"
  | "halopesa"
  | "card"
  | "bank";

export type TicketTier = "early-bird" | "student" | "professional" | "vip";

export type SessionType =
  | "ceremony"
  | "keynote"
  | "panel"
  | "workshop"
  | "session"
  | "showcase"
  | "roundtable"
  | "pitch"
  | "demo"
  | "break"
  | "networking";

export type SponsorTier = "title" | "platinum" | "gold" | "silver" | "partner";

export type NotificationCategory =
  | "registration"
  | "schedule"
  | "reminder"
  | "announcement"
  | "payment"
  | "certificate";

export type CommunicationChannel = "email" | "sms" | "push";

export type CommunicationStatus = "draft" | "sent";

export type AudienceSegment =
  | "all"
  | "paid"
  | "student"
  | "vip"
  | "checked-in";

export type DemoRole = "visitor" | "attendee" | "admin";

export type MilestoneStatus = "done" | "live" | "scheduled";

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string;
  country: string;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  theme: string;
  category: string;
  status: EventStatus;
  format: EventFormat;
  startsAt: string;
  endsAt: string;
  venueId: string;
  capacity: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
  featured: boolean;
  bannerLabel: string;
  highlights: string[];
  faqs: string[];
}

export interface Speaker {
  id: string;
  name: string;
  initials: string;
  role: string;
  organization: string;
  bio: string;
  track: string;
  socialUrl?: string;
}

export interface Session {
  id: string;
  eventId: string;
  title: string;
  dayIndex: number;
  dayLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  speakerId?: string;
  speakerLabel: string;
  room: string;
  type: SessionType;
  description: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  tier: TicketTier;
  price: number;
  currency: string;
  perks: string;
  capacity: number;
  sold: number;
  active: boolean;
}

export interface Attendee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  jobTitle: string;
  country: string;
  roleTitle: string;
  dietary?: string;
  accessibility?: string;
  interests: string[];
  isDemoUser: boolean;
}

export interface Registration {
  id: string;
  eventId: string;
  attendeeId: string;
  ticketTypeId: string;
  status: RegistrationStatus;
  ticketNumber: string;
  createdAt: string;
  dietary?: string;
  accessibility?: string;
}

export interface Payment {
  id: string;
  registrationId: string;
  attendeeId: string;
  eventId: string;
  reference: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  /** Set when a real provider (Snippe) is processing this payment. */
  provider?: "snippe";
  providerPaymentId?: string;
  providerReference?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: SponsorTier;
  website: string;
  contact: string;
  active: boolean;
  eventIds: string[];
}

export interface CheckIn {
  id: string;
  registrationId: string;
  attendeeId: string;
  eventId: string;
  ticketNumber: string;
  checkedInAt: string;
  undone: boolean;
}

export interface Certificate {
  id: string;
  attendeeId: string;
  eventId: string;
  certificateId: string;
  issuedAt: string;
}

export interface AppNotification {
  id: string;
  attendeeId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  createdAt: string;
  read: boolean;
}

export interface Communication {
  id: string;
  eventId: string;
  channel: CommunicationChannel;
  audience: AudienceSegment;
  subject: string;
  body: string;
  status: CommunicationStatus;
  createdAt: string;
  sentAt?: string;
}

export interface NetworkingProfile {
  id: string;
  attendeeId: string;
  publicName: string;
  initials: string;
  jobTitle: string;
  organization: string;
  interests: string[];
  bio: string;
}

export interface Connection {
  id: string;
  fromAttendeeId: string;
  toAttendeeId: string;
  createdAt: string;
}

export interface SavedSession {
  attendeeId: string;
  sessionId: string;
}

export interface TimelineMilestone {
  id: string;
  eventId: string;
  title: string;
  date: string;
  status: MilestoneStatus;
  dayIndex?: number;
}

export interface OrganizationSettings {
  organizationName: string;
  brandName: string;
  contactEmail: string;
  contactPhone: string;
  defaultCurrency: string;
  defaultCity: string;
  defaultCountry: string;
  vatPercent: number;
  registrationOpenByDefault: boolean;
  notifyOnRegistration: boolean;
  notifyOnPayment: boolean;
}

export interface PlatformDatabase {
  version: number;
  venues: Venue[];
  events: Event[];
  speakers: Speaker[];
  sessions: Session[];
  ticketTypes: TicketType[];
  attendees: Attendee[];
  registrations: Registration[];
  payments: Payment[];
  sponsors: Sponsor[];
  checkIns: CheckIn[];
  certificates: Certificate[];
  notifications: AppNotification[];
  communications: Communication[];
  networkingProfiles: NetworkingProfile[];
  connections: Connection[];
  savedSessions: SavedSession[];
  milestones: TimelineMilestone[];
  settings: OrganizationSettings;
}
