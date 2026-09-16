import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { StatusPill } from "../../components/shared/Widgets";
import { formatRange } from "../../lib/dates";
import { formatMoney } from "../../lib/money";

export function AdminDashboardPage() {
  const { db } = usePlatform();
  const paid = db.payments.filter((item) => item.status === "paid");
  const revenue = paid.reduce((sum, item) => sum + item.amount, 0);
  const checkins = db.checkIns.filter((item) => !item.undone).length;
  const featured = db.events.find((event) => event.featured && event.status !== "completed") ?? db.events.find((event) => event.status !== "completed") ?? db.events[0];
  const eventTickets = featured ? db.ticketTypes.filter((ticket) => ticket.eventId === featured.id) : [];
  const eventRegistrations = featured ? db.registrations.filter((registration) => registration.eventId === featured.id && registration.status !== "cancelled") : [];
  const eventSessions = featured ? db.sessions.filter((session) => session.eventId === featured.id) : [];
  const totalCapacity = eventTickets.reduce((sum, ticket) => sum + ticket.capacity, 0);
  const sold = eventTickets.reduce((sum, ticket) => sum + ticket.sold, 0);
  const capacityPercent = totalCapacity ? Math.min(100, Math.round((sold / totalCapacity) * 100)) : 0;

  const alerts: Array<[string, string]> = [];
  if (!featured) alerts.push(["No upcoming event", "Create or publish an event before registrations can begin."]);
  if (featured && eventTickets.length === 0) alerts.push(["Ticket setup incomplete", "Add at least one ticket or registration type for the active event."]);
  if (featured && eventSessions.length === 0) alerts.push(["Schedule not configured", "The active event has no sessions in the demo data yet."]);
  if (capacityPercent >= 85) alerts.push(["Capacity is getting tight", `${capacityPercent}% of configured ticket capacity is already allocated.`]);

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Event operations</p>
          <h1>Admin dashboard</h1>
          <p className="nt-lede">Run the next Neurotech event, understand registration health and get to the operational work that matters today.</p>
        </div>
        <div className="nt-actions">
          <Link to="/admin/events/new" className="nt-btn">Create event</Link>
          <Link to="/admin/events" className="nt-btn ghost">Manage events</Link>
        </div>
      </div>

      <div className="nt-mini-stat-grid">
        {[
          [String(db.events.length), "Events"],
          [String(db.registrations.length), "Registrations"],
          [String(checkins), "Check-ins"],
          [formatMoney(revenue), "Paid revenue"],
        ].map(([value, label]) => (
          <div key={label} className="nt-mini-stat">
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="nt-dashboard-grid">
        <div className="nt-dashboard-stack">
          <section className="nt-priority-card">
            <p className="nt-kicker" style={{ color: "#8ad356" }}>Active event context</p>
            {featured ? (
              <>
                <h2>{featured.title}</h2>
                <div className="nt-priority-meta">
                  <span>{formatRange(featured.startsAt, featured.endsAt)}</span>
                  <span>{eventRegistrations.length} active registrations</span>
                  <span>{eventSessions.length} scheduled sessions</span>
                </div>
                <div style={{ maxWidth: 620, marginBottom: 26 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8, color: "#c0ccba", fontSize: 12.5 }}>
                    <span>Ticket allocation</span>
                    <span>{sold}/{totalCapacity || "—"} · {capacityPercent}%</span>
                  </div>
                  <div className="nt-progress" style={{ background: "rgba(255,255,255,.12)" }}>
                    <span style={{ width: `${capacityPercent}%` }} />
                  </div>
                </div>
                <div className="nt-actions">
                  <Link to={`/admin/events/${featured.id}`} className="nt-btn accent">Open event workspace</Link>
                  <Link to="/admin/attendees" className="nt-btn ghost" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.22)" }}>
                    Attendees
                  </Link>
                  <Link to="/admin/check-in" className="nt-arrow-link" style={{ color: "#d8e3d1" }}>Check-in →</Link>
                </div>
              </>
            ) : (
              <>
                <h2>Set up the next Neurotech event.</h2>
                <div className="nt-priority-meta"><span>Create an event to begin configuring registration, tickets and schedule.</span></div>
                <Link to="/admin/events/new" className="nt-btn accent">Create event</Link>
              </>
            )}
          </section>

          <section className="nt-panel">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Latest activity</p>
                <h3>Recent registrations</h3>
              </div>
              <Link to="/admin/attendees" className="nt-arrow-link">All attendees →</Link>
            </div>
            <div className="nt-row-list">
              {db.registrations.slice(0, 6).map((item) => {
                const attendee = db.attendees.find((person) => person.id === item.attendeeId);
                const ticket = db.ticketTypes.find((entry) => entry.id === item.ticketTypeId);
                return (
                  <div className="nt-row-item" key={item.id}>
                    <div className="nt-row-main">
                      <strong>{attendee?.fullName ?? "Attendee"}</strong>
                      <span>{ticket?.name ?? "Registration"}</span>
                    </div>
                    <StatusPill value={item.status} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="nt-dashboard-stack">
          <section className="nt-panel">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Attention</p>
                <h3>Operational checks</h3>
              </div>
            </div>
            {alerts.length ? (
              <div className="nt-admin-alerts">
                {alerts.map(([title, body]) => (
                  <div className="nt-admin-alert" key={title}>
                    <span aria-hidden="true">!</span>
                    <div>
                      <strong>{title}</strong>
                      <span>{body}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="nt-empty" style={{ padding: 26 }}>No setup warnings are visible in the current demo data.</div>
            )}
          </section>

          <section className="nt-panel">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Ticket allocation</p>
                <h3>Capacity by type</h3>
              </div>
              <Link to="/admin/tickets" className="nt-arrow-link">Configure →</Link>
            </div>
            {eventTickets.length ? eventTickets.slice(0, 4).map((ticket) => {
              const percent = ticket.capacity ? Math.min(100, Math.round((ticket.sold / ticket.capacity) * 100)) : 0;
              return (
                <div key={ticket.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 7, fontSize: 13 }}>
                    <span>{ticket.name}</span>
                    <span className="nt-muted">{ticket.sold}/{ticket.capacity}</span>
                  </div>
                  <div className="nt-progress"><span style={{ width: `${percent}%` }} /></div>
                </div>
              );
            }) : <p className="nt-muted">No ticket types configured for the active event.</p>}
          </section>
        </div>
      </div>

      <section style={{ marginTop: 20 }}>
        <div className="nt-panel-header">
          <div>
            <p className="nt-kicker">Quick operations</p>
            <h3 style={{ margin: 0, font: "700 20px Manrope,sans-serif" }}>Go directly to the work</h3>
          </div>
        </div>
        <div className="nt-operation-grid">
          {[
            ["/admin/check-in", "Check in attendees", "Open the event-day attendance workflow."],
            ["/admin/schedule", "Manage schedule", "Update sessions, rooms and the running program."],
            ["/admin/communications", "Send communications", "Prepare attendee-facing updates and reminders."],
            ["/admin/reports", "Review reports", "Inspect registration, payment and event activity."],
          ].map(([to, title, description]) => (
            <Link key={to} to={to} className="nt-operation-card">
              <span aria-hidden="true">↗</span>
              <strong>{title}</strong>
              <span>{description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
