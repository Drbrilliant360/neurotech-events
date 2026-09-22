import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { StatusPill } from "../../components/shared/Widgets";
import { downloadTextFile, toCsv } from "../../lib/csv";
import { formatDateTime, minutesBetween } from "../../lib/dates";
import { formatMoney, paymentMethodLabel } from "../../lib/money";
import type { CommunicationChannel, PaymentStatus, SponsorTier, TicketTier } from "../../domain/types";
import { AdminEventFormPage } from "./AdminEventsPage";
import { AdminEventPicker, ScopedAdminPage, type EditorProps } from "./AdminEventPicker";
import { isApiEnabled, ApiError } from "../../services/api";
import { getAuthToken } from "../../services/auth";
import { buildCataloguePayload, readAdminCredential } from "../../services/catalogue";
import { syncCatalogue } from "../../services/payments";
import type { Event } from "../../domain/types";

export function AdminEventEditPage() {
  const { eventId } = useParams();
  return <AdminEventFormPage mode="edit" eventId={eventId} />;
}

export function AdminEventNewPage() {
  return <AdminEventFormPage mode="new" />;
}

function AdminTicketsEditor({ events, event, setEventId }: EditorProps) {
  const { db, saveTicket, deleteTicket } = usePlatform();
  const eventId = event.id;
  const [publishState, setPublishState] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function publishCatalogue() {
    const credential = readAdminCredential(getAuthToken());
    if (!credential) {
      setPublishState("Sign in as a platform admin or open All transactions and enter the admin token first.");
      return;
    }
    setPublishing(true);
    setPublishState(null);
    try {
      const result = await syncCatalogue(credential, buildCataloguePayload(db));
      setPublishState(`Published ${result.events_upserted} events and ${result.ticket_types_upserted} ticket types to the payments server (${result.ticket_types_deactivated} retired).`);
    } catch (err) {
      setPublishState(err instanceof ApiError ? err.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  }
  const [name, setName] = useState("Professional");
  const [price, setPrice] = useState("100000");
  const [capacity, setCapacity] = useState("100");
  const [tier, setTier] = useState<TicketTier>("professional");
  const [pending, setPending] = useState<string | null>(null);
  const tickets = db.ticketTypes.filter((ticket) => ticket.eventId === eventId);

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Ticket types</h1>
      <AdminEventPicker events={events} event={event} onChange={setEventId} />
      {isApiEnabled() ? (
        <div className="nt-card" style={{ marginBottom: 16 }}>
          <h3>Live payments</h3>
          <p className="nt-muted">Tickets can only be sold online once this catalogue has been published to the payments server, which prices every checkout itself.</p>
          <div className="nt-actions" style={{ marginTop: 10, alignItems: "center" }}>
            <button type="button" className="nt-btn" onClick={publishCatalogue} disabled={publishing}>{publishing ? "Publishing…" : "Publish catalogue to payments server"}</button>
            {publishState ? <span className="nt-muted" role="status">{publishState}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="nt-card" style={{ marginBottom: 16 }}>
        <h3>Create ticket tier</h3>
        <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <label className="nt-field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Price</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Capacity</span>
            <input value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Tier</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as TicketTier)}>
              {["early-bird", "student", "professional", "vip"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="nt-btn" style={{ marginTop: 12 }} onClick={() => saveTicket({ eventId, name, price: Number(price) || 0, capacity: Number(capacity) || 0, tier, perks: name })}>
          Save ticket
        </button>
      </div>
      {tickets.map((ticket) => (
        <div key={ticket.id} className="nt-card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div className="nt-kicker">{ticket.name}</div>
              <div style={{ font: "700 26px Manrope,sans-serif" }}>{formatMoney(ticket.price)}</div>
              <div className="nt-muted">
                Sold {ticket.sold} of {ticket.capacity} · {ticket.active ? "Active" : "Inactive"}
              </div>
            </div>
            <div>
              <button type="button" className="nt-chip" onClick={() => saveTicket({ ...ticket, active: !ticket.active })}>
                {ticket.active ? "Deactivate" : "Activate"}
              </button>
              <button type="button" className="nt-chip" onClick={() => setPending(ticket.id)}>
                Delete
              </button>
            </div>
          </div>
          <div style={{ height: 8, background: "#eef1e1", borderRadius: 99, marginTop: 10 }}>
            <div style={{ width: `${Math.min(100, (ticket.sold / Math.max(1, ticket.capacity)) * 100)}%`, height: "100%", background: "#8ad356" }} />
          </div>
        </div>
      ))}
      {pending ? (
        <Confirm onCancel={() => setPending(null)} onOk={() => { deleteTicket(pending); setPending(null); }} />
      ) : null}
    </div>
  );
}

export function AdminAttendeesPage() {
  const { db } = usePlatform();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "time">("time");
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const list = db.registrations
      .map((registration) => ({
        registration,
        attendee: db.attendees.find((item) => item.id === registration.attendeeId),
        ticket: db.ticketTypes.find((item) => item.id === registration.ticketTypeId),
        payment: db.payments.find((item) => item.registrationId === registration.id),
        checkIn: db.checkIns.find((item) => item.registrationId === registration.id && !item.undone),
      }))
      .filter((row) => {
        const hay = `${row.attendee?.fullName} ${row.attendee?.email} ${row.attendee?.organization}`.toLowerCase();
        return !query || hay.includes(query.toLowerCase());
      })
      .sort((a, b) =>
        sort === "name"
          ? (a.attendee?.fullName ?? "").localeCompare(b.attendee?.fullName ?? "")
          : b.registration.createdAt.localeCompare(a.registration.createdAt),
      );
    return list;
  }, [db, query, sort]);
  const pageSize = 8;
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  const open = rows.find((row) => row.registration.id === openId);

  function exportCsv() {
    downloadTextFile(
      "attendees.csv",
      toCsv(
        ["Name", "Email", "Organization", "Ticket", "Payment", "Status", "Check-in"],
        rows.map((row) => [
          row.attendee?.fullName ?? "",
          row.attendee?.email ?? "",
          row.attendee?.organization ?? "",
          row.ticket?.name ?? "",
          row.payment?.status ?? "",
          row.registration.status,
          row.checkIn ? "yes" : "no",
        ]),
      ),
    );
  }

  return (
    <div>
      <h1>Attendees</h1>
      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search attendees…" onChange={(e) => setQuery(e.target.value)} />
        <select className="nt-chip" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="time">Newest</option>
          <option value="name">Name</option>
        </select>
        <button type="button" className="nt-btn" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <div className="nt-table-wrap">
        <table className="nt-table">
          <thead>
            <tr>
              <th>Attendee</th>
              <th>Organization</th>
              <th>Ticket</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Check-in</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.registration.id}>
                <td>
                  {row.attendee?.fullName}
                  <div className="nt-muted">{row.attendee?.email}</div>
                </td>
                <td>{row.attendee?.organization}</td>
                <td>{row.ticket?.name}</td>
                <td>
                  <StatusPill value={row.payment?.status ?? "—"} />
                </td>
                <td>
                  <StatusPill value={row.registration.status} />
                </td>
                <td>{row.checkIn ? "Yes" : "No"}</td>
                <td>
                  <button type="button" className="nt-chip" onClick={() => setOpenId(row.registration.id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="nt-chip" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="nt-chip" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
      {open ? (
        <div className="nt-dialog" role="dialog" aria-modal="true" onClick={() => setOpenId(null)}>
          <div className="nt-dialog-card" onClick={(e) => e.stopPropagation()}>
            <h2>{open.attendee?.fullName}</h2>
            <p>
              {open.attendee?.email} · {open.attendee?.phone}
              <br />
              {open.attendee?.organization}
              <br />
              Registered {formatDateTime(open.registration.createdAt)}
            </p>
            <button type="button" className="nt-btn" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminCheckInPage() {
  const { db, checkIn, undoScan } = usePlatform();
  const [query, setQuery] = useState("");
  const [scanner, setScanner] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const history = db.checkIns.filter((item) => !item.undone);
  const tickets = db.registrations.filter((item) => item.status === "confirmed");

  function run(value: string) {
    const result = checkIn(value);
    setMessage(result.message);
    setDuplicate(Boolean(result.duplicate));
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1>Check-in</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
        <div className="nt-card">
          <label className="nt-field">
            <span>Lookup name, email or ticket ID</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className="nt-btn" style={{ marginTop: 12 }} onClick={() => run(query)}>
            Confirm check-in
          </button>
          <button type="button" className="nt-btn ghost" style={{ marginTop: 8 }} onClick={() => setScanner(!scanner)}>
            {scanner ? "Close scanner" : "Mock QR scanner"}
          </button>
          {scanner ? (
            <div className="nt-grid" style={{ marginTop: 12 }}>
              {tickets.slice(0, 8).map((item) => (
                <button key={item.id} type="button" className="nt-choice" onClick={() => run(item.ticketNumber)}>
                  Scan {item.ticketNumber}
                </button>
              ))}
            </div>
          ) : null}
          {message ? <p className={duplicate ? "error" : ""}>{duplicate ? `Duplicate: ${message}` : message}</p> : null}
        </div>
        <div>
          <div className="nt-card" style={{ background: "#111510", color: "#fbfaf0", marginBottom: 12 }}>
            <div className="nt-kicker" style={{ color: "#9aa583" }}>Checked in</div>
            <div style={{ font: "700 48px Manrope,sans-serif" }}>{history.length}</div>
          </div>
          <div className="nt-card">
            <div className="nt-kicker">History</div>
            {history.slice(0, 8).map((item) => {
              const attendee = db.attendees.find((person) => person.id === item.attendeeId);
              return (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                  <span>
                    {attendee?.fullName}
                    <div className="nt-muted">{item.ticketNumber}</div>
                  </span>
                  <button type="button" className="nt-chip" onClick={() => undoScan(item.id)}>
                    Undo
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminScheduleEditor({ events, event, setEventId }: EditorProps) {
  const { db, saveSession, deleteSession } = usePlatform();
  const sessions = db.sessions.filter((item) => item.eventId === event.id);
  const days = Array.from(new Set(sessions.map((item) => item.dayIndex))).sort();
  const [day, setDay] = useState(0);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [room, setRoom] = useState("Hall A");
  const [speakerId, setSpeakerId] = useState(db.speakers[0]?.id ?? "");
  const [conflicts, setConflicts] = useState<string[]>([]);

  return (
    <div style={{ maxWidth: 880 }}>
      <h1>Schedule builder</h1>
      <AdminEventPicker events={events} event={event} onChange={setEventId} />
      <div className="nt-card" style={{ marginBottom: 16 }}>
        <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <label className="nt-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Start</span>
            <input value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>End</span>
            <input value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Room</span>
            <input value={room} onChange={(e) => setRoom(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Speaker</span>
            <select value={speakerId} onChange={(e) => setSpeakerId(e.target.value)}>
              {db.speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  {speaker.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="nt-btn"
          style={{ marginTop: 12 }}
          onClick={() => {
            if (!title.trim()) return;
            const found = saveSession({
              eventId: event.id,
              title,
              startTime,
              endTime,
              room,
              speakerId,
              dayIndex: days[day] ?? 0,
              dayLabel: `Day ${(days[day] ?? 0) + 1}`,
              type: "session",
            });
            setConflicts(found.map((item) => item.title));
            setTitle("");
          }}
        >
          Add session
        </button>
        {conflicts.length > 0 ? <p className="error">Possible conflict with: {conflicts.join(", ")}</p> : null}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {days.map((value, index) => (
          <button key={value} type="button" className={`nt-chip ${index === day ? "is-on" : ""}`} onClick={() => setDay(index)}>
            Day {value + 1}
          </button>
        ))}
      </div>
      {sessions
        .filter((session) => session.dayIndex === (days[day] ?? 0))
        .map((session) => (
          <div key={session.id} className="nt-card" style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <strong>
                {session.startTime} {session.title}
              </strong>
              <div className="nt-muted">
                {session.room} · {minutesBetween(session.startTime, session.endTime)} min · {session.speakerLabel}
              </div>
            </div>
            <button type="button" className="nt-chip" onClick={() => deleteSession(session.id)}>
              Delete
            </button>
          </div>
        ))}
    </div>
  );
}

function AdminTimelineEditor({ events, event, setEventId }: EditorProps) {
  const { db, saveMilestone, removeMilestone } = usePlatform();
  const [day, setDay] = useState<"all" | number>("all");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const dayOptions = Array.from({ length: eventDayCount(event) }, (_, index) => index);
  const items = db.milestones.filter((item) => item.eventId === event.id && (day === "all" || item.dayIndex === day));
  return (
    <div style={{ maxWidth: 660 }}>
      <h1>Event timeline</h1>
      <AdminEventPicker events={events} event={event} onChange={setEventId} />
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button type="button" className={`nt-chip ${day === "all" ? "is-on" : ""}`} onClick={() => setDay("all")}>
          All
        </button>
        {dayOptions.map((value) => (
          <button key={value} type="button" className={`nt-chip ${day === value ? "is-on" : ""}`} onClick={() => setDay(value)}>
            Day {value + 1}
          </button>
        ))}
      </div>
      <div className="nt-card" style={{ marginBottom: 16 }}>
        <h3>Add milestone</h3>
        <div className="nt-grid" style={{ gridTemplateColumns: "2fr 1fr auto", alignItems: "end" }}>
          <label className="nt-field"><span>Title</span><input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Speaker briefing" /></label>
          <label className="nt-field"><span>Date</span><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></label>
          <button
            type="button"
            className="nt-btn"
            disabled={!newTitle.trim() || !newDate}
            onClick={() => {
              saveMilestone({ eventId: event.id, title: newTitle.trim(), date: newDate, status: "scheduled", dayIndex: day === "all" ? undefined : day });
              setNewTitle("");
            }}
          >
            + Add milestone
          </button>
        </div>
      </div>
      {items.length === 0 ? <p className="nt-muted">No milestones for this view yet.</p> : null}
      {items.map((item) => (
        <div key={item.id} className="nt-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div>
            <strong>{item.title}</strong>
            <div className="nt-muted">{item.date}{typeof item.dayIndex === "number" ? ` · Day ${item.dayIndex + 1}` : ""}</div>
          </div>
          <div className="nt-actions" style={{ alignItems: "center" }}>
            <StatusPill value={item.status} />
            <button type="button" className="nt-chip" onClick={() => saveMilestone({ ...item, status: nextMilestoneStatus(item.status) })}>
              Mark {nextMilestoneStatus(item.status)}
            </button>
            <button type="button" className="nt-chip" onClick={() => removeMilestone(item.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminPosterEditor({ events, event, setEventId }: EditorProps) {
  const { db } = usePlatform();
  const [title, setTitle] = useState(event.title);
  const [subtitle, setSubtitle] = useState(event.subtitle);
  const [layout, setLayout] = useState<"dark" | "light">("dark");
  const speaker = db.speakers[0];
  return (
    <div>
      <h1>Poster designer</h1>
      <AdminEventPicker events={events} event={event} onChange={setEventId} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
        <div className="nt-card">
          <label className="nt-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Subtitle</span>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Layout</span>
            <select value={layout} onChange={(e) => setLayout(e.target.value as typeof layout)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <button type="button" className="nt-btn" onClick={() => window.print()}>
            Print preview
          </button>
        </div>
        <div className="nt-poster" style={layout === "light" ? { background: "#fbfaf0", color: "#12150c" } : undefined}>
          <div>
            <div className="nt-kicker">NeuroTech Events</div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div>
            <p>{event.startsAt.slice(0, 10)} · {db.venues.find((venue) => venue.id === event.venueId)?.city}</p>
            <p>Featuring {speaker?.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCommsEditor({ events, event, setEventId }: EditorProps) {
  const { db, saveComms } = usePlatform();
  const [channel, setChannel] = useState<CommunicationChannel>("email");
  const [body, setBody] = useState("Thank you for joining NeuroTech Summit.");
  const [subject, setSubject] = useState("Event reminder");
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Communications</h1>
      <AdminEventPicker events={events} event={event} onChange={setEventId} />
      <p className="nt-lede">Messages are simulated in local state. Nothing is sent.</p>
      <div className="nt-card">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["email", "sms", "push"] as const).map((item) => (
            <button key={item} type="button" className={`nt-chip ${channel === item ? "is-on" : ""}`} onClick={() => setChannel(item)}>
              {item}
            </button>
          ))}
        </div>
        <label className="nt-field">
          <span>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Message</span>
          <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button type="button" className="nt-btn" onClick={() => saveComms({ eventId: event.id, body, subject, channel, status: "sent", audience: "all" })}>
          Simulate send
        </button>
        <button type="button" className="nt-btn ghost" onClick={() => saveComms({ eventId: event.id, body, subject, channel, status: "draft", audience: "all" })}>
          Save draft
        </button>
      </div>
      {db.communications.map((item) => (
        <div key={item.id} className="nt-card" style={{ marginTop: 10 }}>
          <StatusPill value={item.status} /> {item.channel} · {item.subject}
          <div className="nt-muted">{item.body}</div>
        </div>
      ))}
    </div>
  );
}

function AdminSponsorsEditor({ events, event, setEventId }: EditorProps) {
  const { db, saveSponsor, deleteSponsor } = usePlatform();
  const [name, setName] = useState("");
  const [tier, setTier] = useState<SponsorTier>("gold");
  const [pending, setPending] = useState<string | null>(null);
  return (
    <div>
      <h1>Sponsors</h1>
      <AdminEventPicker events={events} event={event} onChange={setEventId} />
      <div className="nt-card" style={{ marginBottom: 16 }}>
        <label className="nt-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Tier</span>
          <select value={tier} onChange={(e) => setTier(e.target.value as SponsorTier)}>
            {["title", "platinum", "gold", "silver", "partner"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button type="button" className="nt-btn" onClick={() => { if (!name.trim()) return; saveSponsor({ name, tier, eventIds: [event.id], website: "", contact: "" }); setName(""); }}>
          Add sponsor
        </button>
      </div>
      <div className="nt-grid cards">
        {db.sponsors.map((sponsor) => (
          <article key={sponsor.id} className="nt-card">
            <h3>{sponsor.name}</h3>
            <div style={{ color: "#2f7d34" }}>{sponsor.tier}</div>
            <div className="nt-muted">{sponsor.website}</div>
            <StatusPill value={sponsor.active ? "active" : "inactive"} />
            <button type="button" className="nt-chip" onClick={() => saveSponsor({ ...sponsor, active: !sponsor.active })}>
              {sponsor.active ? "Deactivate" : "Activate"}
            </button>
            <button type="button" className="nt-chip" onClick={() => setPending(sponsor.id)}>
              Delete
            </button>
          </article>
        ))}
      </div>
      {pending ? <Confirm onCancel={() => setPending(null)} onOk={() => { deleteSponsor(pending); setPending(null); }} /> : null}
    </div>
  );
}

export function AdminPaymentsPage() {
  const { db, refund } = usePlatform();
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [query, setQuery] = useState("");
  const rows = db.payments.filter((item) => (status === "all" || item.status === status) && `${item.reference} ${item.attendeeId}`.toLowerCase().includes(query.toLowerCase()));
  const total = rows.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  return (
    <div>
      <h1>Payments</h1>
      <div className="nt-grid stats">
        <div className="nt-card">Revenue {formatMoney(total)}</div>
        <div className="nt-card">Successful {db.payments.filter((item) => item.status === "paid").length}</div>
        <div className="nt-card">Pending {db.payments.filter((item) => item.status === "pending" || item.status === "processing").length}</div>
        <div className="nt-card">Failed {db.payments.filter((item) => item.status === "failed").length}</div>
      </div>
      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search reference…" onChange={(e) => setQuery(e.target.value)} />
        <select className="nt-chip" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All</option>
          {["pending", "processing", "paid", "failed", "cancelled", "refunded"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="nt-table-wrap">
        <table className="nt-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Attendee</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const attendee = db.attendees.find((person) => person.id === item.attendeeId);
              return (
                <tr key={item.id}>
                  <td>{item.reference}</td>
                  <td>{attendee?.fullName}</td>
                  <td>{formatMoney(item.amount)}</td>
                  <td>{paymentMethodLabel(item.method)}</td>
                  <td>
                    <StatusPill value={item.status} />
                  </td>
                  <td>
                    {item.status === "paid" ? (
                      <button type="button" className="nt-chip" onClick={() => refund(item.id)}>
                        Simulate refund
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminReportsPage() {
  const { db } = usePlatform();
  const [eventId, setEventId] = useState("all");
  const regs = db.registrations.filter((item) => eventId === "all" || item.eventId === eventId);
  const payments = db.payments.filter((item) => eventId === "all" || item.eventId === eventId);
  const checkins = db.checkIns.filter((item) => !item.undone && (eventId === "all" || item.eventId === eventId));
  const revenue = payments.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const byOrg = Object.entries(
    regs.reduce<Record<string, number>>((acc, item) => {
      const org = db.attendees.find((person) => person.id === item.attendeeId)?.organization ?? "Unknown";
      acc[org] = (acc[org] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const event = db.events.find((item) => item.id === eventId);
  const capacity = event?.capacity ?? db.events.reduce((sum, item) => sum + item.capacity, 0);
  const confirmed = regs.filter((item) => item.status === "confirmed").length;

  function exportCsv() {
    downloadTextFile(
      "reports.csv",
      toCsv(
        ["Metric", "Value"],
        [
          ["Registrations", regs.length],
          ["Confirmed", confirmed],
          ["Check-ins", checkins.length],
          ["Revenue", revenue],
          ["Capacity", capacity],
        ],
      ),
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Reports</h1>
        <button type="button" className="nt-btn" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <select className="nt-chip" value={eventId} onChange={(e) => setEventId(e.target.value)}>
        <option value="all">All events</option>
        {db.events.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <div className="nt-grid stats" style={{ margin: "16px 0" }}>
        <div className="nt-card">Registrations {regs.length}</div>
        <div className="nt-card">Attendance {checkins.length}</div>
        <div className="nt-card">Check-in rate {confirmed ? Math.round((checkins.length / confirmed) * 100) : 0}%</div>
        <div className="nt-card">Revenue {formatMoney(revenue)}</div>
        <div className="nt-card">Capacity {capacity}</div>
      </div>
      <div className="nt-card">
        <div className="nt-kicker">Registrations by organization</div>
        {byOrg.slice(0, 8).map(([org, count]) => (
          <div key={org} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span>{org}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSettingsPage() {
  const { db, updateSettings } = usePlatform();
  const [settings, setSettings] = useState(db.settings);
  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Settings</h1>
      <p className="nt-lede">Organisation defaults used across the site. VAT and currency feed the checkout quote; publish the catalogue after changing them so the payments server matches.</p>
      {(
        [
          ["organizationName", "Organization"],
          ["brandName", "Brand"],
          ["contactEmail", "Contact email"],
          ["contactPhone", "Contact phone"],
          ["defaultCity", "Default city"],
          ["defaultCountry", "Default country"],
          ["defaultCurrency", "Currency (ISO code)"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="nt-field">
          <span>{label}</span>
          <input value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
        </label>
      ))}
      <label className="nt-field">
        <span>VAT percent applied at checkout</span>
        <input type="number" min={0} max={100} step={0.5} value={settings.vatPercent} onChange={(e) => setSettings({ ...settings, vatPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
      </label>
      <label className="nt-field">
        <span>
          <input type="checkbox" checked={settings.registrationOpenByDefault} onChange={(e) => setSettings({ ...settings, registrationOpenByDefault: e.target.checked })} /> New events open for registration by default
        </span>
      </label>
      <label className="nt-field">
        <span>
          <input type="checkbox" checked={settings.notifyOnRegistration} onChange={(e) => setSettings({ ...settings, notifyOnRegistration: e.target.checked })} /> Notify on registration
        </span>
      </label>
      <label className="nt-field">
        <span>
          <input type="checkbox" checked={settings.notifyOnPayment} onChange={(e) => setSettings({ ...settings, notifyOnPayment: e.target.checked })} /> Notify on payment
        </span>
      </label>
      <button type="button" className="nt-btn" onClick={() => updateSettings(settings)}>
        Save settings
      </button>
    </div>
  );
}

function Confirm({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  return (
    <div className="nt-dialog" role="alertdialog" aria-modal="true">
      <div className="nt-dialog-card">
        <h2>Delete this item?</h2>
        <button type="button" className="nt-btn danger" onClick={onOk}>
          Delete
        </button>
        <button type="button" className="nt-btn ghost" onClick={onCancel}>
          Keep
        </button>
      </div>
    </div>
  );
}

export function AdminTicketsPage() {
  return <ScopedAdminPage render={(scope) => <AdminTicketsEditor key={scope.event.id} {...scope} />} />;
}

export function AdminSchedulePage() {
  return <ScopedAdminPage render={(scope) => <AdminScheduleEditor key={scope.event.id} {...scope} />} />;
}

export function AdminTimelinePage() {
  return <ScopedAdminPage render={(scope) => <AdminTimelineEditor key={scope.event.id} {...scope} />} />;
}

export function AdminPosterPage() {
  return <ScopedAdminPage render={(scope) => <AdminPosterEditor key={scope.event.id} {...scope} />} />;
}

export function AdminCommsPage() {
  return <ScopedAdminPage render={(scope) => <AdminCommsEditor key={scope.event.id} {...scope} />} />;
}

export function AdminSponsorsPage() {
  return <ScopedAdminPage render={(scope) => <AdminSponsorsEditor key={scope.event.id} {...scope} />} />;
}

function eventDayCount(event: Event): number {
  const ms = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function nextMilestoneStatus(status: "done" | "live" | "scheduled"): "done" | "live" | "scheduled" {
  return status === "scheduled" ? "live" : status === "live" ? "done" : "scheduled";
}
