import type { PlatformDatabase } from "../../domain/types";

const SUMMIT = "evt_summit_2026";
const WORKSHOP = "evt_bci_workshop";
const CONF = "evt_ai_health";
const FORUM = "evt_clinical_forum";
const BOOTCAMP = "evt_research_bootcamp";
const ZANZIBAR = "evt_zanzibar_day";
const PAST = "evt_summit_2025";

const VENUE_SKYCITY = "ven_skycity";
const VENUE_JNICC = "ven_jnicc";
const VENUE_NM = "ven_nmaist";
const VENUE_DODOMA = "ven_dodoma";
const VENUE_MWANZA = "ven_mwanza";
const VENUE_ONLINE = "ven_online";
const VENUE_ZNZ = "ven_zanzibar";

// Speakers are Neurotech Africa's product teams until each line-up is confirmed.
const SPK = {
  sarufi: "spk_sarufi",
  semacall: "spk_semacall",
  ghala: "spk_ghala",
  snippe: "spk_snippe",
};

export const DEMO_ATTENDEE_ID = "att_bryan";

export function createSeedDatabase(): PlatformDatabase {
  return {
    // Bump when the seed changes so browsers drop an older demo store.
    version: 2,
    venues: [
      {
        id: VENUE_SKYCITY,
        name: "Neurotech Africa HQ",
        address: "SkyCity Mall, 9th Floor",
        city: "Dar es Salaam",
        region: "Dar es Salaam",
        country: "Tanzania",
      },
      {
        id: VENUE_JNICC,
        name: "Julius Nyerere Convention Centre",
        address: "Shaaban Robert St",
        city: "Dar es Salaam",
        region: "Dar es Salaam",
        country: "Tanzania",
      },
      {
        id: VENUE_NM,
        name: "NM-AIST",
        address: "Nelson Mandela Rd",
        city: "Arusha",
        region: "Arusha",
        country: "Tanzania",
      },
      {
        id: VENUE_DODOMA,
        name: "University of Dodoma",
        address: "UDOM Campus",
        city: "Dodoma",
        region: "Dodoma",
        country: "Tanzania",
      },
      {
        id: VENUE_MWANZA,
        name: "Mwanza Conference Hall",
        address: "Nyerere Rd",
        city: "Mwanza",
        region: "Mwanza",
        country: "Tanzania",
      },
      {
        id: VENUE_ONLINE,
        name: "Online",
        address: "Virtual",
        city: "Online",
        region: "Remote",
        country: "Tanzania",
      },
      {
        id: VENUE_ZNZ,
        name: "Zanzibar Beach Resort",
        address: "Nungwi",
        city: "Zanzibar",
        region: "Zanzibar",
        country: "Tanzania",
      },
    ],
    // Sample catalogue themed on Neurotech Africa's products and community programmes
    // (https://www.neurotech.africa). Dates, prices and capacities are placeholders; keep in sync
    // with backend/app/db/seed.py.
    events: [
      {
        id: SUMMIT,
        slug: "neurotech-summit-2026",
        title: "Neurotech Summit 2026",
        subtitle: "Infrastructure for Africa's conversational commerce",
        description:
          "The Neurotech Summit brings together African founders, operators, banks, telcos and builders around the infrastructure behind conversational commerce: AI agents, WhatsApp storefronts, cloud voice and payment rails. Three days of keynotes, product sessions and hands-on labs with the teams behind Sarufi, SemaCall, Ghala and Snippe.",
        theme: "Where customer journeys start in conversation",
        category: "Summit",
        status: "published",
        format: "physical",
        startsAt: "2026-11-20T08:00:00+03:00",
        endsAt: "2026-11-22T18:00:00+03:00",
        venueId: VENUE_JNICC,
        capacity: 1200,
        registrationOpensAt: "2026-09-01T00:00:00+03:00",
        registrationClosesAt: "2026-11-15T23:59:00+03:00",
        featured: true,
        bannerLabel: "Summit",
        highlights: ["AI agents", "WhatsApp commerce", "Cloud voice", "Payments", "Generative AI"],
        faqs: [
          "Is the ticket transferable?",
          "Do students get a discount?",
          "Will sessions be recorded?",
          "Which mobile money networks can I pay with?",
        ],
      },
      {
        id: WORKSHOP,
        slug: "sarufi-ai-agents-workshop",
        title: "Sarufi AI Agents Workshop",
        subtitle: "Build and deploy a customer-facing AI agent in a day",
        description:
          "A practical, full-day workshop on Sarufi. Build an AI agent with its own knowledge base, deploy it to WhatsApp, SMS, USSD, web and API channels, and connect payments so it can close a sale.",
        theme: "Hands-on AI agents",
        category: "Workshop",
        status: "published",
        format: "physical",
        startsAt: "2026-12-10T09:00:00+03:00",
        endsAt: "2026-12-10T17:00:00+03:00",
        venueId: VENUE_SKYCITY,
        capacity: 80,
        registrationOpensAt: "2026-09-15T00:00:00+03:00",
        registrationClosesAt: "2026-12-05T23:59:00+03:00",
        featured: false,
        bannerLabel: "Workshop",
        highlights: ["AI agents", "WhatsApp", "USSD", "Hands-on"],
        faqs: ["Do I need to bring a laptop?", "Do I need coding experience?"],
      },
      {
        id: CONF,
        slug: "ghala-whatsapp-commerce-clinic",
        title: "Ghala WhatsApp Commerce Clinic",
        subtitle: "Set up a storefront, catalogue and payments inside WhatsApp",
        description:
          "A working clinic for merchants and teams moving sales into WhatsApp with Ghala: storefronts, product catalogues, order management and payment collection without leaving the conversation.",
        theme: "Commerce inside the chat",
        category: "Clinic",
        status: "draft",
        format: "hybrid",
        startsAt: "2027-01-15T09:00:00+03:00",
        endsAt: "2027-01-15T15:00:00+03:00",
        venueId: VENUE_SKYCITY,
        capacity: 120,
        registrationOpensAt: "2026-11-01T00:00:00+03:00",
        registrationClosesAt: "2027-01-10T23:59:00+03:00",
        featured: false,
        bannerLabel: "Clinic",
        highlights: ["WhatsApp commerce", "Merchants", "Payments"],
        faqs: ["Can I attend online?", "Should I bring my product list?"],
      },
      {
        id: FORUM,
        slug: "semacall-customer-operations-forum",
        title: "SemaCall Customer Operations Forum",
        subtitle: "Modern call centres: routing, Swahili transcription and quality monitoring",
        description:
          "A forum for customer service leaders on running cloud call centres with SemaCall: call routing, transcription in Swahili and English, encryption and agent performance monitoring.",
        theme: "Customer operations at scale",
        category: "Forum",
        status: "draft",
        format: "physical",
        startsAt: "2027-02-02T09:00:00+03:00",
        endsAt: "2027-02-02T16:00:00+03:00",
        venueId: VENUE_JNICC,
        capacity: 200,
        registrationOpensAt: "2026-12-01T00:00:00+03:00",
        registrationClosesAt: "2027-01-28T23:59:00+03:00",
        featured: false,
        bannerLabel: "Forum",
        highlights: ["Cloud voice", "Call centres", "Swahili AI"],
        faqs: ["Who is this forum for?"],
      },
      {
        id: BOOTCAMP,
        slug: "snippe-payments-developer-day",
        title: "Snippe Payments Developer Day",
        subtitle: "Accept mobile money, cards and bank transfers from your product",
        description:
          "An online developer day on Snippe payment infrastructure: payment links, checkout pages and APIs for accepting mobile money, cards and bank transfers.",
        theme: "Payments for builders",
        category: "Developer day",
        status: "published",
        format: "online",
        startsAt: "2027-02-18T10:00:00+03:00",
        endsAt: "2027-02-18T16:00:00+03:00",
        venueId: VENUE_ONLINE,
        capacity: 300,
        registrationOpensAt: "2026-12-15T00:00:00+03:00",
        registrationClosesAt: "2027-02-15T23:59:00+03:00",
        featured: false,
        bannerLabel: "Developer day",
        highlights: ["Payments", "Mobile money", "Developers"],
        faqs: ["Will recordings be shared?", "Is there a sandbox account?"],
      },
      {
        id: ZANZIBAR,
        slug: "generative-ai-tanzania-meetup",
        title: "Generative AI Tanzania Meetup",
        subtitle: "Students, professionals and builders exploring GenAI for East Africa",
        description:
          "The Generative AI Tanzania meetup is a welcoming space for students, professionals and builders of every experience level to share AI trends, tools and techniques, and to meet collaborators, mentors and employers. Free to attend; registration required.",
        theme: "Generative AI for Tanzania and East Africa",
        category: "Meetup",
        status: "published",
        format: "physical",
        startsAt: "2026-10-24T14:00:00+03:00",
        endsAt: "2026-10-24T18:00:00+03:00",
        venueId: VENUE_SKYCITY,
        capacity: 150,
        registrationOpensAt: "2026-09-15T00:00:00+03:00",
        registrationClosesAt: "2026-10-23T23:59:00+03:00",
        featured: false,
        bannerLabel: "Meetup",
        highlights: ["Generative AI", "Community", "Networking"],
        faqs: ["Is the meetup free?", "Do I need AI experience to attend?"],
      },
      {
        id: PAST,
        slug: "generative-ai-tanzania-hackathon-2025",
        title: "Generative AI Tanzania Hackathon 2025",
        subtitle: "Completed community hackathon",
        description: "A completed community hackathon where teams built generative AI prototypes for Tanzanian use cases. Certificates are available to checked-in participants.",
        theme: "Building with generative AI",
        category: "Hackathon",
        status: "completed",
        format: "physical",
        startsAt: "2025-08-12T09:00:00+03:00",
        endsAt: "2025-08-13T17:00:00+03:00",
        venueId: VENUE_SKYCITY,
        capacity: 120,
        registrationOpensAt: "2025-05-01T00:00:00+03:00",
        registrationClosesAt: "2025-08-01T23:59:00+03:00",
        featured: false,
        bannerLabel: "Hackathon",
        highlights: ["Generative AI", "Hackathon"],
        faqs: [],
      },
    ],
    speakers: [
      team(SPK.sarufi, "Sarufi team", "SA", "AI agents platform", "Builds customer-facing AI agents for WhatsApp, SMS, USSD, web and API, with knowledge bases and payments.", "AI agents"),
      team(SPK.semacall, "SemaCall team", "SC", "Cloud call centre", "Runs call routing, Swahili and English transcription, encryption and agent performance monitoring.", "Cloud voice"),
      team(SPK.ghala, "Ghala team", "GH", "WhatsApp commerce", "Helps merchants run storefronts, catalogues, orders and payment collection inside WhatsApp.", "Commerce"),
      team(SPK.snippe, "Snippe team", "SN", "Payment infrastructure", "Accepts mobile money, cards and bank transfers through payment links and checkout pages.", "Payments"),
    ],
    sessions: [
      sess("ses_open", SUMMIT, "Opening: the conversational business stack", 0, "Day 1", "2026-11-20", "09:00", "09:45", undefined, "Neurotech Africa", "Main Hall", "keynote"),
      sess("ses_agents", SUMMIT, "AI agents that sell, support and collect", 0, "Day 1", "2026-11-20", "10:30", "11:30", SPK.sarufi, "Sarufi team", "Main Hall", "session"),
      sess("ses_voice", SUMMIT, "Cloud voice and Swahili transcription", 0, "Day 1", "2026-11-20", "14:00", "15:00", SPK.semacall, "SemaCall team", "Hall A", "session"),
      sess("ses_ghala", SUMMIT, "Lab: launch a WhatsApp storefront", 1, "Day 2", "2026-11-21", "10:00", "12:00", SPK.ghala, "Ghala team", "Lab 1", "workshop"),
      sess("ses_snippe", SUMMIT, "Payment rails for African products", 1, "Day 2", "2026-11-21", "14:00", "15:00", SPK.snippe, "Snippe team", "Hall A", "session"),
      sess("ses_net", SUMMIT, "Builders and partners networking", 1, "Day 2", "2026-11-21", "17:00", "18:30", undefined, "Open networking", "Terrace", "networking"),
      sess("ses_demo", SUMMIT, "Product demos and community showcase", 2, "Day 3", "2026-11-22", "10:00", "12:30", undefined, "Community teams", "Demo Floor", "showcase"),
      sess("ses_close", SUMMIT, "Closing and awards", 2, "Day 3", "2026-11-22", "16:00", "17:00", undefined, "Neurotech Africa", "Main Hall", "ceremony"),
      sess("ses_w1", WORKSHOP, "Build your first Sarufi agent", 0, "Day 1", "2026-12-10", "09:00", "12:00", SPK.sarufi, "Sarufi team", "Lab 1", "workshop"),
      sess("ses_w2", WORKSHOP, "Deploy to WhatsApp and connect payments", 0, "Day 1", "2026-12-10", "13:00", "16:30", SPK.sarufi, "Sarufi team", "Lab 1", "workshop"),
    ],
    ticketTypes: [
      tix("tix_student", SUMMIT, "Student", "student", 20000, "All keynotes and sessions · Student ID required", 500, 327),
      tix("tix_pro", SUMMIT, "Professional", "professional", 100000, "All sessions, labs, lunch and certificate", 500, 410),
      tix("tix_vip", SUMMIT, "VIP", "vip", 300000, "Front seating, speaker dinner, partner roundtable", 100, 62),
      tix("tix_early", SUMMIT, "Early Bird", "early-bird", 75000, "Professional access at early rate · limited", 80, 80, false),
      tix("tix_w", WORKSHOP, "Workshop", "professional", 60000, "Full-day lab · bring a laptop", 80, 46),
      tix("tix_c", CONF, "Clinic pass", "professional", 30000, "Clinic seat and setup support", 120, 12),
      tix("tix_f", FORUM, "Forum pass", "professional", 45000, "Forum sessions and lunch", 200, 0),
      tix("tix_b", BOOTCAMP, "Online", "student", 0, "Complimentary online seat", 300, 41),
      tix("tix_z", ZANZIBAR, "Community seat", "student", 0, "Free seat · registration required", 150, 64),
      tix("tix_past", PAST, "Hackathon pass", "professional", 40000, "Completed hackathon", 120, 94),
    ],
    attendees: [
      att(DEMO_ATTENDEE_ID, "Bryan Kachocho", "bryan@neurotech.africa", "+255 712 345 678", "Neurotech Africa", "Founder", "Tanzania", "Professional", ["AI agents", "Payments", "Generative AI"], true),
      att("att_zainab", "Zainab Komba", "zainab.komba@muhas.ac.tz", "+255 754 111 222", "MUHAS", "Lecturer", "Tanzania", "VIP", ["Generative AI", "Research"]),
      att("att_juma", "Juma Msumari", "juma.msumari@udsm.ac.tz", "+255 713 444 555", "University of Dar es Salaam", "Student", "Tanzania", "Student", ["Research", "AI"]),
      att("att_neema", "Neema Joseph", "neema.joseph@mnh.or.tz", "+255 765 333 111", "Muhimbili National Hospital", "Patient Experience Lead", "Tanzania", "Student", ["Cloud voice", "Customer service"]),
      att("att_emma", "Emmanuel Lema", "emmanuel.lema@moh.go.tz", "+255 622 888 999", "Ministry of Health", "Programme Officer", "Tanzania", "Professional", ["Policy", "Digital services"]),
      att("att_grace", "Grace Mollel", "grace@saharaventures.com", "+255 688 222 101", "Sahara Ventures", "Investment Analyst", "Kenya", "VIP", ["Investment", "Health"]),
      att("att_aisha", "Aisha Salim", "aisha.salim@udom.ac.tz", "+255 767 909 404", "University of Dodoma", "PhD Candidate", "Tanzania", "Student", ["NLP", "Research"]),
      att("att_elias", "Elias Kilonzo", "elias.kilonzo@kcmc.ac.tz", "+255 754 606 707", "KCMC, Moshi", "Software Engineer", "Tanzania", "Professional", ["APIs", "Payments"]),
      att("att_lucy", "Lucy Mtei", "lucy.mtei@ihi.or.tz", "+255 713 202 303", "Ifakara Health Institute", "Data Scientist", "Tanzania", "Professional", ["Generative AI", "Data"]),
    ],
    registrations: [
      reg("reg_bryan", SUMMIT, DEMO_ATTENDEE_ID, "tix_pro", "confirmed", "NTS-000234", "2026-09-12T10:14:00+03:00"),
      reg("reg_zainab", SUMMIT, "att_zainab", "tix_vip", "confirmed", "NTS-000188", "2026-09-10T09:02:00+03:00"),
      reg("reg_juma", SUMMIT, "att_juma", "tix_student", "pending", "NTS-000301", "2026-09-13T16:40:00+03:00"),
      reg("reg_neema", SUMMIT, "att_neema", "tix_student", "confirmed", "NTS-000210", "2026-09-11T11:20:00+03:00"),
      reg("reg_emma", SUMMIT, "att_emma", "tix_pro", "pending", "NTS-000276", "2026-09-14T08:11:00+03:00"),
      reg("reg_grace", SUMMIT, "att_grace", "tix_vip", "confirmed", "NTS-000155", "2026-09-08T14:33:00+03:00"),
      reg("reg_aisha", SUMMIT, "att_aisha", "tix_student", "confirmed", "NTS-000199", "2026-09-09T19:05:00+03:00"),
      reg("reg_elias", SUMMIT, "att_elias", "tix_pro", "cancelled", "NTS-000142", "2026-09-07T12:00:00+03:00"),
      reg("reg_lucy", SUMMIT, "att_lucy", "tix_pro", "confirmed", "NTS-000173", "2026-09-09T08:44:00+03:00"),
      reg("reg_bryan_past", PAST, DEMO_ATTENDEE_ID, "tix_past", "confirmed", "NTS-000041", "2025-06-02T10:00:00+03:00"),
    ],
    payments: [
      pay("pay_bryan", "reg_bryan", DEMO_ATTENDEE_ID, SUMMIT, "TXN-90231", 118000, "mpesa", "paid", "2026-09-12T10:18:00+03:00"),
      pay("pay_zainab", "reg_zainab", "att_zainab", SUMMIT, "TXN-90230", 354000, "card", "paid", "2026-09-10T09:08:00+03:00"),
      pay("pay_juma", "reg_juma", "att_juma", SUMMIT, "TXN-90229", 23600, "airtel", "pending", "2026-09-13T16:42:00+03:00"),
      pay("pay_elias", "reg_elias", "att_elias", SUMMIT, "TXN-90228", 118000, "bank", "refunded", "2026-09-07T12:20:00+03:00"),
      pay("pay_grace", "reg_grace", "att_grace", SUMMIT, "TXN-90227", 354000, "mixx", "paid", "2026-09-08T14:40:00+03:00"),
      pay("pay_neema", "reg_neema", "att_neema", SUMMIT, "TXN-90226", 23600, "halopesa", "paid", "2026-09-11T11:24:00+03:00"),
      pay("pay_aisha", "reg_aisha", "att_aisha", SUMMIT, "TXN-90225", 23600, "mpesa", "paid", "2026-09-09T19:10:00+03:00"),
      pay("pay_lucy", "reg_lucy", "att_lucy", SUMMIT, "TXN-90224", 118000, "card", "paid", "2026-09-09T08:50:00+03:00"),
      pay("pay_emma", "reg_emma", "att_emma", SUMMIT, "TXN-90223", 118000, "mpesa", "failed", "2026-09-14T08:16:00+03:00"),
      pay("pay_past", "reg_bryan_past", DEMO_ATTENDEE_ID, PAST, "TXN-80110", 47200, "mpesa", "paid", "2025-06-02T10:08:00+03:00"),
    ],
    // Neurotech Africa's own products as event partners; external sponsors are added per event.
    sponsors: [
      spo("spo_snippe", "Snippe", "title", "https://www.neurotech.africa", "info@neurotech.africa", [SUMMIT, BOOTCAMP]),
      spo("spo_sarufi", "Sarufi", "platinum", "https://www.neurotech.africa", "info@neurotech.africa", [SUMMIT, WORKSHOP]),
      spo("spo_ghala", "Ghala", "gold", "https://www.neurotech.africa", "info@neurotech.africa", [SUMMIT, CONF]),
      spo("spo_semacall", "SemaCall", "gold", "https://www.neurotech.africa", "info@neurotech.africa", [SUMMIT, FORUM]),
    ],
    checkIns: [
      cin("cin_zainab", "reg_zainab", "att_zainab", SUMMIT, "NTS-000188", "2026-11-20T09:42:00+03:00"),
      cin("cin_bryan", "reg_bryan", DEMO_ATTENDEE_ID, SUMMIT, "NTS-000234", "2026-11-20T09:41:00+03:00"),
      cin("cin_neema", "reg_neema", "att_neema", SUMMIT, "NTS-000210", "2026-11-20T09:39:00+03:00"),
      cin("cin_aisha", "reg_aisha", "att_aisha", SUMMIT, "NTS-000199", "2026-11-20T09:36:00+03:00"),
      cin("cin_past", "reg_bryan_past", DEMO_ATTENDEE_ID, PAST, "NTS-000041", "2025-08-12T08:55:00+03:00"),
    ],
    certificates: [
      {
        id: "cert_bryan_past",
        attendeeId: DEMO_ATTENDEE_ID,
        eventId: PAST,
        certificateId: "CERT-NT-0041",
        issuedAt: "2025-08-14T10:00:00+03:00",
      },
    ],
    notifications: [
      ntf("ntf1", DEMO_ATTENDEE_ID, "Your session starts in 30 minutes", "Hall A · 14:00 · Cloud voice and Swahili transcription", "reminder", "2026-11-20T13:30:00+03:00", false),
      ntf("ntf2", DEMO_ATTENDEE_ID, "Room changed", "WhatsApp storefront lab moved to Lab 1", "schedule", "2026-11-19T18:12:00+03:00", false),
      ntf("ntf3", DEMO_ATTENDEE_ID, "Programme published", "Sarufi, SemaCall, Ghala and Snippe sessions are on the schedule", "announcement", "2026-11-01T09:00:00+03:00", true),
      ntf("ntf4", DEMO_ATTENDEE_ID, "Payment successfully received", "TZS 118,000 · Mobile Money", "payment", "2026-09-12T10:18:00+03:00", true),
      ntf("ntf5", DEMO_ATTENDEE_ID, "Registration confirmed", "Ticket NTS-000234 issued", "registration", "2026-09-12T10:18:30+03:00", true),
      ntf("ntf6", DEMO_ATTENDEE_ID, "Certificate available", "Generative AI Tanzania Hackathon 2025 certificate is ready", "certificate", "2025-08-14T10:05:00+03:00", false),
    ],
    communications: [
      {
        id: "com_welcome",
        eventId: SUMMIT,
        channel: "email",
        audience: "paid",
        subject: "Registration confirmation",
        body: "Your Neurotech Summit ticket is confirmed. Bring a photo ID to check-in.",
        status: "sent",
        createdAt: "2026-09-12T11:00:00+03:00",
        sentAt: "2026-09-12T11:00:00+03:00",
      },
      {
        id: "com_draft",
        eventId: SUMMIT,
        channel: "sms",
        audience: "all",
        subject: "Event reminder",
        body: "Neurotech Summit starts 20 Nov at JNICC. Your badge is ready at check-in.",
        status: "draft",
        createdAt: "2026-11-01T08:00:00+03:00",
      },
    ],
    networkingProfiles: [
      net("net_bryan", DEMO_ATTENDEE_ID, "Bryan Kachocho", "BK", "Founder", "Neurotech Africa", ["AI agents", "Payments", "WhatsApp"], "Building conversational commerce for African businesses."),
      net("net_neema", "att_neema", "Neema Joseph", "NJ", "Patient Experience Lead", "Muhimbili National Hospital", ["Cloud voice", "Customer service"], "Exploring Swahili voice agents for patient support."),
      net("net_juma", "att_juma", "Juma Msumari", "JM", "Student", "University of Dar es Salaam", ["Research", "AI"], "Looking for collaborators on AI agents."),
      net("net_grace", "att_grace", "Grace Mollel", "GM", "Investment Analyst", "Sahara Ventures", ["Investment", "Health"], "Open to founder conversations."),
      net("net_aisha", "att_aisha", "Aisha Salim", "AS", "PhD Candidate", "University of Dodoma", ["NLP", "Research"], "Researching speech recognition for Swahili."),
      net("net_lucy", "att_lucy", "Lucy Mtei", "LM", "Data Scientist", "Ifakara Health Institute", ["Generative AI", "Data"], "Working on Swahili language models."),
    ],
    connections: [{ id: "con_1", fromAttendeeId: DEMO_ATTENDEE_ID, toAttendeeId: "att_grace", createdAt: "2026-09-20T12:00:00+03:00" }],
    savedSessions: [
      { attendeeId: DEMO_ATTENDEE_ID, sessionId: "ses_agents" },
      { attendeeId: DEMO_ATTENDEE_ID, sessionId: "ses_ghala" },
      { attendeeId: DEMO_ATTENDEE_ID, sessionId: "ses_open" },
    ],
    milestones: [
      { id: "ms1", eventId: SUMMIT, title: "Registration opens", date: "2026-09-01", status: "done" },
      { id: "ms2", eventId: SUMMIT, title: "Early bird ends", date: "2026-09-30", status: "live" },
      { id: "ms3", eventId: SUMMIT, title: "Speaker announcement", date: "2026-10-10", status: "scheduled" },
      { id: "ms4", eventId: SUMMIT, title: "Programme released", date: "2026-11-01", status: "scheduled" },
      { id: "ms5", eventId: SUMMIT, title: "Event setup", date: "2026-11-19", status: "scheduled" },
      { id: "ms6", eventId: SUMMIT, title: "Speaker arrival", date: "2026-11-19", status: "scheduled" },
      { id: "ms7", eventId: SUMMIT, title: "Event begins", date: "2026-11-20", status: "scheduled", dayIndex: 0 },
      { id: "ms8", eventId: SUMMIT, title: "Networking lounge", date: "2026-11-21", status: "scheduled", dayIndex: 1 },
      { id: "ms9", eventId: SUMMIT, title: "Event closing", date: "2026-11-22", status: "scheduled", dayIndex: 2 },
      { id: "ms10", eventId: SUMMIT, title: "Post-event certificates", date: "2026-11-28", status: "scheduled" },
    ],
    settings: {
      organizationName: "Neurotech Africa",
      brandName: "Neurotech Events",
      contactEmail: "info@neurotech.africa",
      contactPhone: "+255 699 920 009",
      defaultCurrency: "TZS",
      defaultCity: "Dar es Salaam",
      defaultCountry: "Tanzania",
      vatPercent: 18,
      registrationOpenByDefault: true,
      notifyOnRegistration: true,
      notifyOnPayment: true,
    },
  };
}

function team(id: string, name: string, initials: string, role: string, bio: string, track: string) {
  return { id, name, initials, role, organization: "Neurotech Africa", bio, track, socialUrl: "https://www.neurotech.africa" };
}

function sess(
  id: string,
  eventId: string,
  title: string,
  dayIndex: number,
  dayLabel: string,
  date: string,
  startTime: string,
  endTime: string,
  speakerId: string | undefined,
  speakerLabel: string,
  room: string,
  type: PlatformDatabase["sessions"][number]["type"],
) {
  return {
    id,
    eventId,
    title,
    dayIndex,
    dayLabel,
    date,
    startTime,
    endTime,
    speakerId,
    speakerLabel,
    room,
    type,
    description: title,
  };
}

function tix(
  id: string,
  eventId: string,
  name: string,
  tier: PlatformDatabase["ticketTypes"][number]["tier"],
  price: number,
  perks: string,
  capacity: number,
  sold: number,
  active = true,
) {
  return { id, eventId, name, tier, price, currency: "TZS", perks, capacity, sold, active };
}

function att(
  id: string,
  fullName: string,
  email: string,
  phone: string,
  organization: string,
  jobTitle: string,
  country: string,
  roleTitle: string,
  interests: string[],
  isDemoUser = false,
) {
  return {
    id,
    fullName,
    email,
    phone,
    organization,
    jobTitle,
    country,
    roleTitle,
    interests,
    isDemoUser,
  };
}

function reg(
  id: string,
  eventId: string,
  attendeeId: string,
  ticketTypeId: string,
  status: PlatformDatabase["registrations"][number]["status"],
  ticketNumber: string,
  createdAt: string,
) {
  return { id, eventId, attendeeId, ticketTypeId, status, ticketNumber, createdAt };
}

function pay(
  id: string,
  registrationId: string,
  attendeeId: string,
  eventId: string,
  reference: string,
  amount: number,
  method: PlatformDatabase["payments"][number]["method"],
  status: PlatformDatabase["payments"][number]["status"],
  createdAt: string,
) {
  return {
    id,
    registrationId,
    attendeeId,
    eventId,
    reference,
    amount,
    currency: "TZS",
    method,
    status,
    createdAt,
    updatedAt: createdAt,
  };
}

function spo(
  id: string,
  name: string,
  tier: PlatformDatabase["sponsors"][number]["tier"],
  website: string,
  contact: string,
  eventIds: string[],
) {
  return { id, name, tier, website, contact, active: true, eventIds };
}

function cin(
  id: string,
  registrationId: string,
  attendeeId: string,
  eventId: string,
  ticketNumber: string,
  checkedInAt: string,
) {
  return { id, registrationId, attendeeId, eventId, ticketNumber, checkedInAt, undone: false };
}

function ntf(
  id: string,
  attendeeId: string,
  title: string,
  body: string,
  category: PlatformDatabase["notifications"][number]["category"],
  createdAt: string,
  read: boolean,
) {
  return { id, attendeeId, title, body, category, createdAt, read };
}

function net(
  id: string,
  attendeeId: string,
  publicName: string,
  initials: string,
  jobTitle: string,
  organization: string,
  interests: string[],
  bio: string,
) {
  return { id, attendeeId, publicName, initials, jobTitle, organization, interests, bio };
}
