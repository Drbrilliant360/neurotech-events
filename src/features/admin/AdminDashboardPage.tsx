import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { StatusPill } from "../../components/shared/Widgets";
import { formatMoney } from "../../lib/money";

export function AdminDashboardPage() {
  const { db } = usePlatform();
  const paid = db.payments.filter((item) => item.status === "paid");
  const revenue = paid.reduce((sum, item) => sum + item.amount, 0);
  const checkins = db.checkIns.filter((item) => !item.undone).length;
  const months = ["Sep 1", "Sep 2", "Sep 3", "Sep 4", "Oct 1", "Oct 2", "Oct 3", "Oct 4", "Nov 1", "Nov 2"];
  const trend = db.registrations.reduce<number[]>((acc, item) => {
    acc[item.createdAt.length % months.length] = (acc[item.createdAt.length % months.length] ?? 0) + 1;
    return acc;
  }, Array(months.length).fill(0) as number[]);
  const max = Math.max(1, ...trend);
  const dist = db.ticketTypes
    .filter((ticket) => ticket.eventId === (db.events.find((event) => event.featured)?.id ?? db.events[0].id))
    .slice(0, 4);

  return (
    <div>
      <h1>Admin dashboard</h1>
      <p className="nt-lede">Operational snapshot from local demo data.</p>
      <div className="nt-grid stats" style={{ marginBottom: 22 }}>
        {[
          ["Events", String(db.events.length)],
          ["Registrations", String(db.registrations.length)],
          ["Attendees", String(db.attendees.length)],
          ["Revenue", formatMoney(revenue)],
          ["Check-ins", String(checkins)],
        ].map(([label, value]) => (
          <div key={label} className="nt-card">
            <div className="nt-muted">{label}</div>
            <div style={{ font: "700 28px Manrope,sans-serif" }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 20 }}>
        <div className="nt-card">
          <div className="nt-kicker">Registration trend</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180 }}>
            {trend.map((value, index) => (
              <div key={months[index]} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ height: `${(value / max) * 100}%`, minHeight: 8, background: index > 7 ? "#111510" : "#8ad356", borderRadius: "7px 7px 0 0" }} />
                <div className="nt-muted">{months[index]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="nt-card">
          <div className="nt-kicker">Latest registrations</div>
          {db.registrations.slice(0, 6).map((item) => {
            const attendee = db.attendees.find((person) => person.id === item.attendeeId);
            const ticket = db.ticketTypes.find((entry) => entry.id === item.ticketTypeId);
            return (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(18,21,12,.06)" }}>
                <span>
                  {attendee?.fullName}
                  <div className="nt-muted">{ticket?.name}</div>
                </span>
                <StatusPill value={item.status} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="nt-card" style={{ marginTop: 20 }}>
        <div className="nt-kicker">Ticket distribution</div>
        {dist.map((ticket) => (
          <div key={ticket.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{ticket.name}</span>
              <span>
                {ticket.sold}/{ticket.capacity}
              </span>
            </div>
            <div style={{ height: 8, background: "#eef1e1", borderRadius: 99 }}>
              <div style={{ width: `${Math.min(100, (ticket.sold / ticket.capacity) * 100)}%`, height: "100%", background: "#8ad356" }} />
            </div>
          </div>
        ))}
        <Link to="/admin/reports">Open reports</Link>
      </div>
    </div>
  );
}
