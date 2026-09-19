import { useCallback, useMemo, useState } from "react";
import { MEDIA } from "./media";

export type ScreenId = string;

const ACCENT = "#8ad356";

export function useAppModel() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [step, setStep] = useState(1);
  const [ticket, setTicket] = useState("Professional");
  const [day, setDay] = useState(0);
  const [payMethod, setPayMethod] = useState("M-Pesa");
  const [payStatus, setPayStatus] = useState<"processing" | "success" | "failed">("processing");

  const go = useCallback((id: ScreenId) => () => setScreen(id), []);

  const model = useMemo(() => {
    const accent = ACCENT;

    const PUB: [string, string][] = [
      ["home", "Home"],
      ["events", "Events"],
      ["event", "Event detail"],
      ["speakers", "Speakers"],
      ["schedule", "Schedule"],
      ["register", "Registration"],
      ["checkout", "Checkout"],
      ["payment", "Payment status"],
      ["receipt", "Receipt"],
    ];
    const USR: [string, string][] = [
      ["u-dash", "Dashboard"],
      ["u-ticket", "My ticket"],
      ["u-schedule", "My schedule"],
      ["u-network", "Networking"],
      ["u-notify", "Notifications"],
      ["u-cert", "Certificates"],
    ];
    const ADM = [
      { title: "Overview", items: [["a-dash", "Dashboard"]] as [string, string][] },
      {
        title: "Event management",
        items: [
          ["a-events", "Events"],
          ["a-create", "Create event"],
          ["a-tickets", "Tickets"],
        ] as [string, string][],
      },
      {
        title: "Registration",
        items: [
          ["a-attendees", "Attendees"],
          ["a-checkin", "Check-in"],
        ] as [string, string][],
      },
      {
        title: "Program",
        items: [
          ["a-schedule", "Schedule builder"],
          ["a-timeline", "Timeline"],
        ] as [string, string][],
      },
      {
        title: "Marketing",
        items: [
          ["a-poster", "Poster designer"],
          ["a-comms", "Communications"],
          ["a-sponsors", "Sponsors"],
        ] as [string, string][],
      },
      {
        title: "Finance & data",
        items: [
          ["a-payments", "Payments"],
          ["a-reports", "Reports"],
        ] as [string, string][],
      },
    ];

    const group = screen.startsWith("u-")
      ? "user"
      : screen.startsWith("a-")
        ? "admin"
        : "public";

    const is = {
      public: group === "public",
      user: group === "user",
      admin: group === "admin",
      home: screen === "home",
      events: screen === "events",
      event: screen === "event",
      speakers: screen === "speakers",
      schedule: screen === "schedule",
      register: screen === "register",
      checkout: screen === "checkout",
      payment: screen === "payment",
      receipt: screen === "receipt",
      uDash: screen === "u-dash",
      uTicket: screen === "u-ticket",
      uSchedule: screen === "u-schedule",
      uNetwork: screen === "u-network",
      uNotify: screen === "u-notify",
      uCert: screen === "u-cert",
      aDash: screen === "a-dash",
      aEvents: screen === "a-events",
      aCreate: screen === "a-create",
      aTickets: screen === "a-tickets",
      aAttendees: screen === "a-attendees",
      aCheckin: screen === "a-checkin",
      aSchedule: screen === "a-schedule",
      aTimeline: screen === "a-timeline",
      aPoster: screen === "a-poster",
      aComms: screen === "a-comms",
      aSponsors: screen === "a-sponsors",
      aPayments: screen === "a-payments",
      aReports: screen === "a-reports",
    };

    const groupTabs = (
      [
        ["public", "Public site", "home"],
        ["user", "Attendee", "u-dash"],
        ["admin", "Admin", "a-dash"],
      ] as const
    ).map(([id, label, first]) => ({
      label,
      go: go(first),
      bg: group === id ? "#111510" : "transparent",
      fg: group === id ? "#fbfaf0" : "#5b6349",
    }));

    const chipSource: [string, string][] =
      group === "public" ? PUB : group === "user" ? USR : ADM.flatMap((s) => s.items);

    const screenChips = chipSource.map(([id, label]) => ({
      label,
      go: go(id),
      bg: screen === id ? "#fff" : "transparent",
      fg: screen === id ? "#12150c" : "#6b7358",
      border: screen === id ? "rgba(18,21,12,.2)" : "rgba(18,21,12,.09)",
    }));

    const siteNav = (
      [
        ["home", "Home"],
        ["events", "Events"],
        ["speakers", "Speakers"],
        ["schedule", "Schedule"],
        ["event", "About"],
      ] as const
    ).map(([id, label]) => ({
      label,
      go: go(id),
      bg: screen === id ? "#f2f4e4" : "transparent",
      fg: screen === id ? "#12150c" : "#5b6349",
    }));

    const userNav = USR.map(([id, label]) => ({
      label,
      go: go(id),
      bg: screen === id ? "#111510" : "transparent",
      fg: screen === id ? "#fbfaf0" : "#454d38",
      font: (screen === id ? "600" : "500") + " 14.5px 'DM Sans', sans-serif",
    }));

    const adminNav = ADM.map((sec) => ({
      title: sec.title,
      items: sec.items.map(([id, label]) => ({
        label,
        go: go(id),
        bg: screen === id ? "rgba(138,211,86,.16)" : "transparent",
        fg: screen === id ? "#c9e8a6" : "#a7b28d",
        font: (screen === id ? "600" : "500") + " 13.5px 'DM Sans', sans-serif",
      })),
    }));

    const DAYS = [
      {
        label: "Day 1",
        date: "20 Nov",
        items: [
          { time: "09:00", title: "Opening ceremony", speaker: "Summit committee", room: "Main Hall", type: "Ceremony", duration: "30 min" },
          { time: "10:00", title: "Keynote: The decade of the brain", speaker: "Dr. Neema Mwakalinga", room: "Main Hall", type: "Keynote", duration: "45 min" },
          { time: "11:30", title: "Panel: AI and neuroscience", speaker: "4 panellists", room: "Hall A", type: "Panel", duration: "60 min" },
          { time: "14:00", title: "Brain computer interfaces", speaker: "Dr. Juma Kibwana", room: "Hall B", type: "Workshop", duration: "90 min" },
          { time: "16:30", title: "Neurohealth in primary care", speaker: "Dr. Amina Salum", room: "Hall A", type: "Session", duration: "45 min" },
        ],
      },
      {
        label: "Day 2",
        date: "21 Nov",
        items: [
          { time: "09:30", title: "Research showcase", speaker: "12 teams", room: "Main Hall", type: "Showcase", duration: "60 min" },
          { time: "11:00", title: "Neural signal processing lab", speaker: "Eng. Baraka Msangi", room: "Lab 1", type: "Workshop", duration: "120 min" },
          { time: "14:00", title: "Investor roundtable", speaker: "Moderated · CRDB & Sahara Ventures", room: "Hall C", type: "Roundtable", duration: "75 min" },
          { time: "16:00", title: "Startup pitch finals", speaker: "8 startups", room: "Main Hall", type: "Pitch", duration: "90 min" },
        ],
      },
      {
        label: "Day 3",
        date: "22 Nov",
        items: [
          { time: "09:00", title: "Regulation and neuro-ethics", speaker: "Prof. Grace Kimaro", room: "Hall A", type: "Session", duration: "45 min" },
          { time: "11:00", title: "Clinical demo: assistive BCI", speaker: "Muhimbili National Hospital team", room: "Demo Floor", type: "Demo", duration: "90 min" },
          { time: "14:30", title: "Closing keynote", speaker: "Dr. Neema Mwakalinga", room: "Main Hall", type: "Keynote", duration: "45 min" },
          { time: "16:00", title: "Awards and closing", speaker: "Summit committee", room: "Main Hall", type: "Ceremony", duration: "60 min" },
        ],
      },
    ];

    const dayTabs = DAYS.map((d, i) => ({
      label: d.label,
      date: d.date,
      go: () => setDay(i),
      bg: i === day ? "#111510" : "#fff",
      fg: i === day ? "#fbfaf0" : "#5b6349",
      border: i === day ? "#111510" : "rgba(18,21,12,.12)",
    }));

    const TICKETS = [
      { name: "Student", price: "TZS 20,000", perks: "All keynotes and sessions · Student ID required" },
      { name: "Professional", price: "TZS 100,000", perks: "All sessions, workshops, lunch and certificate" },
      { name: "VIP", price: "TZS 300,000", perks: "Front seating, speaker dinner, investor roundtable" },
    ];
    const chosen = TICKETS.find((t) => t.name === ticket) || TICKETS[1];
    const stepLabels = ["Account", "Personal info", "Ticket", "Payment", "Confirmation"];

    return {
      accent,
      showNav: true,
      showCollage: true,
      is,
      groupTabs,
      screenChips,
      siteNav,
      userNav,
      adminNav,
      dayTabs,
      dayItems: DAYS[day].items,

      goRegister: go("register"),
      goEvents: go("events"),
      goEvent: go("event"),
      goSpeakers: go("speakers"),
      goTicket: go("u-ticket"),
      goUserSchedule: go("u-schedule"),
      goCreate: go("a-create"),
      goCheckout: go("checkout"),
      goReceipt: go("receipt"),

      heroStats: [
        { value: "1,200+", label: "Attendees" },
        { value: "50+", label: "Speakers" },
        { value: "30+", label: "Sessions" },
      ],
      featureStats: [
        { value: "1,200+", label: "Attendees" },
        { value: "50+", label: "Speakers" },
        { value: "30+", label: "Sessions" },
      ],
      collageA: [
        { slot: "collage-1", art: MEDIA.scenes[0], label: "Keynote stage" },
        { slot: "collage-2", art: MEDIA.scenes[3], label: "BCI workshop" },
      ],
      collageB: [
        { slot: "collage-3", art: MEDIA.scenes[1], label: "Research showcase" },
        { slot: "collage-4", art: MEDIA.scenes[2], label: "Networking lounge" },
      ],
      categories: [
        "Neuroscience",
        "AI & Brain Technology",
        "Brain Computer Interface",
        "Neurohealth",
        "Research",
        "Innovation",
        "Investment",
      ],
      whyAttend: [
        { n: "01", title: "Learn", body: "Three tracks of research, clinical and engineering content." },
        { n: "02", title: "Network", body: "Meet 1,200 peers across the region and beyond." },
        { n: "03", title: "Innovate", body: "Hands-on labs with real BCI and imaging hardware." },
        { n: "04", title: "Invest", body: "Roundtables with funds active in African health tech." },
        { n: "05", title: "Collaborate", body: "Find co-authors, clinical partners and pilot sites." },
      ],
      sponsorLogos: [
        { slot: "spo-1", art: MEDIA.sponsors[0], name: "Vodacom Tanzania" },
        { slot: "spo-2", art: MEDIA.sponsors[1], name: "MUHAS" },
        { slot: "spo-3", art: MEDIA.sponsors[2], name: "CRDB Bank" },
        { slot: "spo-4", art: MEDIA.sponsors[3], name: "COSTECH" },
        { slot: "spo-5", art: MEDIA.sponsors[4], name: "Yas Tanzania" },
        { slot: "spo-6", art: MEDIA.sponsors[5], name: "Ministry of Health" },
      ],
      footerCols: [
        { title: "Summit", items: ["Events", "Speakers", "Schedule", "Sponsors"] },
        { title: "Participate", items: ["Become a speaker", "Become a sponsor", "Volunteer", "Press"] },
        { title: "Contact", items: ["hello@neurotech.co.tz", "+255 22 212 3456", "JNICC, Dar es Salaam", "Support"] },
      ],
      featuredSpeakers: [
        { slot: "spk-1", art: MEDIA.speakers[0], initials: "NM", name: "Dr. Neema Mwakalinga", role: "Neuroscientist", org: "MUHAS, Dar es Salaam" },
        { slot: "spk-2", art: MEDIA.speakers[1], name: "Dr. Juma Kibwana", role: "BCI Researcher", org: "Muhimbili National Hospital" },
        { slot: "spk-3", art: MEDIA.speakers[2], name: "Prof. Grace Kimaro", role: "Neuro-ethics", org: "University of Dar es Salaam" },
        { slot: "spk-4", art: MEDIA.speakers[3], name: "Eng. Baraka Msangi", role: "ML Engineer", org: "NM-AIST, Arusha" },
      ],
      speakers: [
        { slot: "spk-1", art: MEDIA.speakers[0], initials: "NM", name: "Dr. Neema Mwakalinga", role: "Neuroscientist", org: "MUHAS, Dar es Salaam" },
        { slot: "spk-2", art: MEDIA.speakers[1], name: "Dr. Juma Kibwana", role: "BCI Researcher", org: "Muhimbili National Hospital" },
        { slot: "spk-3", art: MEDIA.speakers[2], name: "Prof. Grace Kimaro", role: "Neuro-ethics", org: "University of Dar es Salaam" },
        { slot: "spk-4", art: MEDIA.speakers[3], name: "Eng. Baraka Msangi", role: "ML Engineer", org: "NM-AIST, Arusha" },
        { slot: "spk-5", art: MEDIA.speakers[4], name: "Dr. Amina Salum", role: "Neurologist", org: "Mnazi Mmoja Hospital, Zanzibar" },
        { slot: "spk-6", art: MEDIA.speakers[5], initials: "EK", name: "Dr. Elias Kilonzo", role: "Biomedical Eng.", org: "KCMC, Moshi" },
        { slot: "spk-7", art: MEDIA.speakers[6], initials: "LM", name: "Dr. Lucy Mtei", role: "Public Health", org: "Ifakara Health Institute" },
        { slot: "spk-8", art: MEDIA.speakers[7], initials: "JN", name: "Joseph Nyerere", role: "Founder", org: "NeuroLab Tanzania" },
      ],
      speakerFilters: ["All tracks", "Neuroscience", "BCI", "Neurohealth", "Investment"],
      eventFilters: ["Category", "Date", "Location", "Event type"],
      events: [
        { slot: "ev-1", art: MEDIA.events[0], title: "NeuroTech Summit 2026", date: "20 Nov 2026", city: "Dar es Salaam", price: "From TZS 20,000", tag: "Summit" },
        { slot: "ev-2", art: MEDIA.events[1], title: "BCI Hands-on Workshop", date: "10 Dec 2026", city: "Arusha", price: "TZS 60,000", tag: "Workshop" },
        { slot: "ev-3", art: MEDIA.events[2], title: "AI in Healthcare Conference", date: "15 Jan 2027", city: "Dodoma", price: "TZS 80,000", tag: "Conference" },
        { slot: "ev-4", art: MEDIA.events[3], title: "Neurohealth Clinical Forum", date: "02 Feb 2027", city: "Mwanza", price: "TZS 45,000", tag: "Forum" },
        { slot: "ev-5", art: MEDIA.events[4], title: "Research Methods Bootcamp", date: "18 Feb 2027", city: "Online", price: "Free", tag: "Bootcamp" },
        { slot: "ev-6", art: MEDIA.events[5], title: "Zanzibar Neuro Innovation Day", date: "05 Mar 2027", city: "Zanzibar", price: "Invite only", tag: "Investor" },
      ],
      highlights: ["Neuroscience", "Artificial Intelligence", "Brain Computer Interface", "Healthcare", "Startups"],
      faqs: [
        "Is the ticket transferable?",
        "Do students get a discount?",
        "Will sessions be recorded?",
        "Is there airport transport?",
      ],

      steps: stepLabels.map((label, i) => ({
        n: "0" + (i + 1),
        label,
        bg: step === i + 1 ? "#111510" : "#fff",
        fg: step === i + 1 ? "#fbfaf0" : step > i + 1 ? "#2f7d34" : "#7c8467",
        border: step === i + 1 ? "#111510" : "rgba(18,21,12,.1)",
      })),
      wz: { s1: step === 1, s2: step === 2, s3: step === 3, s4: step === 4, s5: step === 5 },
      fields1: ["Full name", "Email", "Phone", "Password"],
      fields2: ["Organization", "Job title", "Country", "Profession", "Areas of interest"],
      ticketOptions: TICKETS.map((t) => ({
        ...t,
        pick: () => setTicket(t.name),
        border: ticket === t.name ? "#2f8f3c" : "rgba(18,21,12,.1)",
        bg: ticket === t.name ? "#f4f8ea" : "#fbfaf0",
      })),
      payMethods: [
        { name: "Mobile Money", detail: "M-Pesa, Airtel Money, Mixx by Yas, HaloPesa" },
        { name: "Card", detail: "Visa, Mastercard — CRDB & NMB" },
        { name: "Bank transfer", detail: "CRDB, NMB, Exim" },
      ],
      chosenTicket: chosen.name,
      chosenPrice: chosen.price,
      nextLabel: step === 4 ? "Go to checkout" : step === 5 ? "Go to dashboard" : "Continue",
      stepNext: () =>
        step === 5
          ? setScreen("u-dash")
          : step === 4
            ? setScreen("checkout")
            : setStep(Math.min(5, step + 1)),
      stepBack: () => setStep(Math.max(1, step - 1)),

      userStats: [
        { value: "01", label: "Upcoming events" },
        { value: "03", label: "Saved sessions" },
        { value: "01", label: "Tickets" },
        { value: "00", label: "Certificates" },
      ],
      interestChips: ["AI", "BCI", "Neuroscience", "Investment"],
      attendeesNetwork: [
        { slot: "spk-1", art: MEDIA.speakers[0], initials: "NM", name: "Dr. Neema Mwakalinga", role: "Neuroscientist", org: "MUHAS, Dar es Salaam", tags: "AI · BCI · Research" },
        { slot: "spk-8", art: MEDIA.speakers[7], initials: "JN", name: "Joseph Nyerere", role: "Founder", org: "NeuroLab Tanzania", tags: "Startups · Hardware" },
        { initials: "AS", name: "Aisha Salim", role: "PhD Candidate", org: "University of Dodoma", tags: "Imaging · Research", art: MEDIA.speakers[4] },
        { slot: "spk-6", art: MEDIA.speakers[5], initials: "EK", name: "Dr. Elias Kilonzo", role: "Biomedical Eng.", org: "KCMC, Moshi", tags: "Devices · Clinical" },
        { initials: "GM", name: "Grace Mollel", role: "Investment Analyst", org: "Sahara Ventures", tags: "Investment · Health", art: MEDIA.speakers[2] },
        { slot: "spk-7", art: MEDIA.speakers[6], initials: "LM", name: "Dr. Lucy Mtei", role: "Public Health", org: "Ifakara Health Institute", tags: "Neurohealth · Policy" },
      ],
      notifications: [
        { title: "Your BCI session starts in 30 minutes", body: "Hall B · 14:00 · Dr. John Doe", dot: accent },
        { title: "Room changed", body: "BCI Workshop moved to Hall B", dot: "#c9a227" },
        { title: "New speaker added", body: "Dr. John Doe joins the Day 1 panel", dot: accent },
        { title: "Payment successfully received", body: "TZS 100,000 · Mobile Money", dot: "#2f7d34" },
        { title: "Registration confirmed", body: "Ticket NTS-000234 issued", dot: "#2f7d34" },
      ],

      adminStats: [
        { label: "Registrants", value: "1,245", delta: "+38 today" },
        { label: "Paid", value: "1,180", delta: "94.8% conversion" },
        { label: "Revenue", value: "TZS 42.5M", delta: "+TZS 3.1M this week" },
        { label: "Checked in", value: "845", delta: "71.6% of paid" },
      ],
      chartBars: ["Aug", "Sep", "Oct 1", "Oct 2", "Oct 3", "Oct 4", "Nov 1", "Nov 2", "Nov 3", "Nov 4"].map(
        (label, i) => ({
          label,
          h: [22, 34, 41, 52, 48, 63, 71, 78, 88, 96][i] + "%",
          color: i > 7 ? "#111510" : accent,
        }),
      ),
      recentRegs: [
        { name: "Juma Msumari", ticket: "Student", status: "Paid", color: "#2f7d34", chip: "#eaf3e0" },
        { name: "Zainab Komba", ticket: "VIP", status: "Paid", color: "#2f7d34", chip: "#eaf3e0" },
        { name: "Emmanuel Lema", ticket: "Professional", status: "Pending", color: "#8a6b1f", chip: "#f6f0dc" },
        { name: "Neema Joseph", ticket: "Student", status: "Paid", color: "#2f7d34", chip: "#eaf3e0" },
        { name: "Bryan Kachocho", ticket: "Professional", status: "Paid", color: "#2f7d34", chip: "#eaf3e0" },
      ],
      adminEvents: [
        { title: "NeuroTech Summit 2026", dates: "20–22 Nov 2026", regs: "1,245", status: "Published", color: "#2f7d34", chip: "#eaf3e0" },
        { title: "BCI Hands-on Workshop", dates: "10 Dec 2026", regs: "86", status: "Published", color: "#2f7d34", chip: "#eaf3e0" },
        { title: "AI in Healthcare Conference", dates: "15 Jan 2027", regs: "12", status: "Draft", color: "#5b6349", chip: "#eef1e1" },
        { title: "Neurohealth Clinical Forum", dates: "02 Feb 2027", regs: "0", status: "Draft", color: "#5b6349", chip: "#eef1e1" },
        { title: "Investor Day: Neuro Startups", dates: "05 Mar 2027", regs: "24", status: "Invite", color: "#8a6b1f", chip: "#f6f0dc" },
      ],
      builderSteps: ["Basic information", "Date & venue", "Tickets", "Speakers", "Schedule", "Registration", "Poster", "Publish"].map(
        (label, i) => ({
          n: "0" + (i + 1),
          label,
          bg: i === 0 ? "#111510" : "#fff",
          fg: i === 0 ? "#fbfaf0" : "#7c8467",
          border: i === 0 ? "#111510" : "rgba(18,21,12,.1)",
        }),
      ),
      venueFields: ["Venue name", "Address", "City / Region", "Country"],
      formats: ["Physical", "Online", "Hybrid"].map((label, i) => ({
        label,
        bg: i === 0 ? "#111510" : "#fbfaf0",
        fg: i === 0 ? "#fbfaf0" : "#5b6349",
        border: i === 0 ? "#111510" : "rgba(18,21,12,.12)",
      })),
      ticketAdmin: [
        { name: "Student", price: "TZS 20,000", sold: "327", total: "500", pct: "65%" },
        { name: "Professional", price: "TZS 100,000", sold: "410", total: "500", pct: "82%" },
        { name: "VIP", price: "TZS 300,000", sold: "62", total: "100", pct: "62%" },
      ],
      attendeeFilters: ["Ticket", "Payment", "Check-in", "Country"],
      attendees: [
        { name: "Bryan Kachocho", org: "NeuroLab Tanzania", ticket: "Professional", payment: "Paid", color: "#2f7d34", chip: "#eaf3e0", checkin: "✓", inColor: "#2f7d34" },
        { name: "Zainab Komba", org: "MUHAS", ticket: "VIP", payment: "Paid", color: "#2f7d34", chip: "#eaf3e0", checkin: "✓", inColor: "#2f7d34" },
        { name: "Juma Msumari", org: "University of Dar es Salaam", ticket: "Student", payment: "Pending", color: "#8a6b1f", chip: "#f6f0dc", checkin: "✕", inColor: "#8a3b2f" },
        { name: "Neema Joseph", org: "Muhimbili National Hospital", ticket: "Student", payment: "Paid", color: "#2f7d34", chip: "#eaf3e0", checkin: "✓", inColor: "#2f7d34" },
        { name: "Emmanuel Lema", org: "Ministry of Health", ticket: "Professional", payment: "Pending", color: "#8a6b1f", chip: "#f6f0dc", checkin: "✕", inColor: "#8a3b2f" },
        { name: "Grace Mollel", org: "Sahara Ventures", ticket: "VIP", payment: "Paid", color: "#2f7d34", chip: "#eaf3e0", checkin: "✓", inColor: "#2f7d34" },
        { name: "Aisha Salim", org: "University of Dodoma", ticket: "Student", payment: "Paid", color: "#2f7d34", chip: "#eaf3e0", checkin: "✓", inColor: "#2f7d34" },
        { name: "Elias Kilonzo", org: "KCMC, Moshi", ticket: "Professional", payment: "Refunded", color: "#8a3b2f", chip: "#f6e5e0", checkin: "✕", inColor: "#8a3b2f" },
      ],
      lastScans: [
        { name: "Zainab Komba", time: "09:42" },
        { name: "Bryan Kachocho", time: "09:41" },
        { name: "Neema Joseph", time: "09:39" },
        { name: "Aisha Salim", time: "09:36" },
      ],
      paymentStats: [
        { label: "Revenue", value: "TZS 42.5M" },
        { label: "Successful", value: "1,180" },
        { label: "Pending", value: "35" },
        { label: "Failed", value: "30" },
      ],
      transactions: [
        { id: "TXN-90231", name: "Bryan Kachocho", amount: "TZS 100,000", method: "M-Pesa", status: "Success", color: "#2f7d34", chip: "#eaf3e0", date: "14 Sep 2026" },
        { id: "TXN-90230", name: "Zainab Komba", amount: "TZS 300,000", method: "CRDB card", status: "Success", color: "#2f7d34", chip: "#eaf3e0", date: "14 Sep 2026" },
        { id: "TXN-90229", name: "Juma Msumari", amount: "TZS 20,000", method: "Airtel Money", status: "Pending", color: "#8a6b1f", chip: "#f6f0dc", date: "13 Sep 2026" },
        { id: "TXN-90228", name: "Elias Kilonzo", amount: "TZS 100,000", method: "NMB transfer", status: "Refunded", color: "#8a3b2f", chip: "#f6e5e0", date: "13 Sep 2026" },
        { id: "TXN-90227", name: "Grace Mollel", amount: "TZS 300,000", method: "Mixx by Yas", status: "Success", color: "#2f7d34", chip: "#eaf3e0", date: "12 Sep 2026" },
        { id: "TXN-90226", name: "Neema Joseph", amount: "TZS 20,000", method: "HaloPesa", status: "Success", color: "#2f7d34", chip: "#eaf3e0", date: "12 Sep 2026" },
      ],
      milestones: [
        { title: "Registration opens", date: "01 September 2026", status: "Done", color: "#2f7d34", chip: "#eaf3e0", dot: "#2f7d34" },
        { title: "Early bird ends", date: "30 September 2026", status: "Live", color: "#2f7d34", chip: "#eaf3e0", dot: accent },
        { title: "Speaker announcement", date: "10 October 2026", status: "Scheduled", color: "#5b6349", chip: "#eef1e1", dot: "#c3ccb0" },
        { title: "Programme released", date: "01 November 2026", status: "Scheduled", color: "#5b6349", chip: "#eef1e1", dot: "#c3ccb0" },
        { title: "Event begins", date: "20 November 2026", status: "Scheduled", color: "#5b6349", chip: "#eef1e1", dot: "#c3ccb0" },
      ],
      posterElements: ["Text", "Image", "Logo", "Speaker card", "Date block", "QR code", "Button"],
      posterActions: ["Save", "Preview", "Download PNG", "Download PDF"],
      posterProps: ["Font", "Size", "Position", "Alignment", "Colour"],
      campaignTypes: ["Email", "SMS", "Push notification"].map((label, i) => ({
        label,
        bg: i === 0 ? "#111510" : "#fbfaf0",
        fg: i === 0 ? "#fbfaf0" : "#5b6349",
        border: i === 0 ? "#111510" : "rgba(18,21,12,.12)",
      })),
      audiences: ["All attendees", "Paid attendees", "Student tickets", "VIP", "Checked-in"],
      sponsors: [
        { slot: "spo-1", art: MEDIA.sponsors[0], name: "Vodacom Tanzania", level: "Title sponsor" },
        { slot: "spo-2", art: MEDIA.sponsors[1], name: "MUHAS", level: "Platinum" },
        { slot: "spo-3", art: MEDIA.sponsors[2], name: "CRDB Bank", level: "Platinum" },
        { slot: "spo-4", art: MEDIA.sponsors[3], name: "COSTECH", level: "Gold" },
        { slot: "spo-5", art: MEDIA.sponsors[4], name: "Yas Tanzania", level: "Silver" },
        { slot: "spo-6", art: MEDIA.sponsors[5], name: "Ministry of Health", level: "Partner" },
      ],
      reportStats: [
        { label: "Registrations", value: "1,245" },
        { label: "Paid", value: "1,180" },
        { label: "Attendance", value: "845" },
        { label: "Revenue", value: "TZS 42.5M" },
      ],
      ticketSales: [
        { label: "Student", count: "327", pct: "55%", color: accent },
        { label: "Professional", count: "410", pct: "82%", color: "#111510" },
        { label: "VIP", count: "62", pct: "24%", color: "#2f8f3c" },
      ],
      payMethods2: (
        [
          { id: "M-Pesa", name: "Vodacom M-Pesa", detail: "USSD push to your phone" },
          { id: "Airtel Money", name: "Airtel Money", detail: "Approve in the Airtel menu" },
          { id: "Mixx by Yas", name: "Mixx by Yas", detail: "Formerly Tigo Pesa" },
          { id: "HaloPesa", name: "HaloPesa", detail: "Halotel wallet" },
          { id: "Card", name: "Card", detail: "Visa / Mastercard via CRDB" },
          { id: "Bank", name: "Bank transfer", detail: "CRDB, NMB, Exim" },
        ] as const
      ).map((m) => ({
        ...m,
        pick: () => setPayMethod(m.id),
        bg: payMethod === m.id ? "#f4f8ea" : "#fbfaf0",
        border: payMethod === m.id ? "#2f8f3c" : "rgba(18,21,12,.1)",
      })),
      payMethod,
      isMomo: ["M-Pesa", "Airtel Money", "Mixx by Yas", "HaloPesa"].includes(payMethod),
      orderLines: [
        { label: chosen.name + " pass × 1", value: chosen.price },
        { label: "Workshop add-on: BCI lab", value: "TZS 15,000" },
        { label: "VAT 18%", value: "TZS 20,700" },
      ],
      orderTotal: "TZS 135,700",
      payStatusTabs: (
        [
          ["processing", "Processing"],
          ["success", "Success"],
          ["failed", "Failed"],
        ] as const
      ).map(([id, label]) => ({
        label,
        go: () => setPayStatus(id),
        bg: payStatus === id ? "#111510" : "#fff",
        fg: payStatus === id ? "#fbfaf0" : "#5b6349",
        border: payStatus === id ? "#111510" : "rgba(18,21,12,.12)",
      })),
      pay: {
        processing: payStatus === "processing",
        success: payStatus === "success",
        failed: payStatus === "failed",
      },
      startPayment: () => {
        setPayStatus("processing");
        setScreen("payment");
      },
      receiptLines: [
        { label: "Professional pass × 1", qty: "1", value: "TZS 100,000" },
        { label: "Workshop add-on: BCI lab", qty: "1", value: "TZS 15,000" },
        { label: "VAT 18%", qty: "—", value: "TZS 20,700" },
      ],
      countries: [
        { name: "Tanzania", count: "850" },
        { name: "Kenya", count: "120" },
        { name: "Uganda", count: "85" },
        { name: "Rwanda", count: "70" },
        { name: "Zambia", count: "62" },
        { name: "Burundi", count: "58" },
      ],
    };
  }, [screen, step, ticket, day, payMethod, payStatus, go]);

  return { screen, model };
}
