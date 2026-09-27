/**
 * Public facts about Neurotech Africa, taken from https://www.neurotech.africa (September 2026).
 * Update here when the company site changes; pages read from this module rather than hard-coding copy.
 */

export const COMPANY = {
  name: "Neurotech Africa",
  website: "https://www.neurotech.africa",
  tagline: "Infrastructure for Africa's conversational commerce",
  summary: "The AI agents, WhatsApp commerce, cloud voice and payment rails African businesses run on.",
  mission: "Building the customer operating layer for African business.",
  address: "SkyCity Mall, 9th Floor, Dar es Salaam, Tanzania",
  email: "info@neurotech.africa",
  phone: "+255 699 920 009",
  meetupUrl: "https://www.neurotech.africa/generative-ai-meetup",
} as const;

export const PRODUCTS = [
  {
    name: "Sarufi",
    kind: "AI agents",
    body: "Customer-facing AI agents with a knowledge base and payments, deployed across WhatsApp, SMS, USSD, web and API.",
    stat: "1M+",
    statLabel: "conversations through live Sarufi agents",
  },
  {
    name: "SemaCall",
    kind: "Cloud call centre",
    body: "Call routing, transcription in Swahili and English, encryption and agent performance monitoring.",
  },
  {
    name: "Ghala",
    kind: "WhatsApp commerce",
    body: "Storefronts, product catalogues, order management and payment collection inside WhatsApp.",
    stat: "190+",
    statLabel: "live Ghala shops",
  },
  {
    name: "Snippe",
    kind: "Payments",
    body: "Mobile money, cards and bank transfers through payment links and checkout pages.",
    stat: "1.2B+ TZS",
    statLabel: "processed through Snippe payment pages",
  },
] as const;

export const PRINCIPLES = [
  ["Start from real behaviour", "African customer journeys begin in chat, voice and mobile money, so that is where we build."],
  ["Make AI operational", "Agents, call intelligence, storefronts, payments, handoff and data that teams act on."],
  ["Build for local scale", "Swahili, local payment flows, regulated teams and high-volume service environments."],
] as const;

/** Generative AI Tanzania meetup and hackathon programme. */
export const COMMUNITY_STATS = [
  ["450+", "attendees across meetups and hackathons"],
  ["10+", "meetups and hackathons held"],
  ["15+", "universities reached"],
] as const;

export const CLIENTS = [
  "dLab Tanzania Data Lab",
  "Zan Fast Ferries",
  "Stanbic Bank",
  "Beem",
  "Azam Marine",
  "Harlos Containers",
  "Kuza Business",
  "ShuleSoft",
  "Africa's Talking",
  "Ruaha Catholic University",
  "Briq",
  "Tanzania ICT Commission",
  "Afya Intelligence",
  "Black Swan",
  "Palladium",
] as const;

export const SUPPORTERS = ["S-BAN", "develoPPP", "FUNGUO Programme", "NVIDIA", "Meta Business Partner"] as const;
