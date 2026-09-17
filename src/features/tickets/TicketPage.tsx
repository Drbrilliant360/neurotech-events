import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, StatusPill } from "../../components/shared/Widgets";
import { formatRange } from "../../lib/dates";
import { venueOf } from "../../repositories/platform";

export function TicketPage() {
  const { db, attendeeId } = usePlatform();
  const registration = db.registrations.find((item) => item.attendeeId === attendeeId && item.status !== "cancelled");
  if (!registration) return <EmptyState title="No ticket yet" body="Register for an event to receive a ticket." />;

  const event = db.events.find((item) => item.id === registration.eventId);
  const attendee = db.attendees.find((item) => item.id === attendeeId);
  const ticket = db.ticketTypes.find((item) => item.id === registration.ticketTypeId);
  const payment = db.payments.find((item) => item.registrationId === registration.id);
  const checkIn = db.checkIns.find((item) => item.registrationId === registration.id && !item.undone);
  const venue = event ? venueOf(db, event.venueId) : undefined;

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Entry pass</p>
          <h1>My ticket</h1>
          <p className="nt-lede">Keep this pass ready for event-day check-in. Your current registration and payment state are shown below.</p>
        </div>
        <StatusPill value={registration.status} />
      </div>

      <div className="nt-dashboard-grid">
        <article className="nt-ticket">
          <div style={{ background: "linear-gradient(145deg,#101710,#1c2b1a)", padding: 28, color: "#fff" }}>
            <div className="nt-kicker" style={{ color: "#a9b9a1" }}>{event?.title}</div>
            <div style={{ font: "700 26px Manrope,sans-serif", marginTop: 10 }}>{attendee?.fullName}</div>
            <div style={{ color: "#8bd05d", marginTop: 4 }}>{ticket?.name} pass</div>
          </div>
          <div style={{ padding: 30, textAlign: "center" }}>
            <div className="nt-qr" role="img" aria-label={`Ticket pattern for ${registration.ticketNumber}`} />
            <div className="nt-muted" style={{ marginTop: 16 }}>Present this pass at the registration desk.</div>
          </div>
          <div style={{ borderTop: "1px dashed rgba(18,21,12,.16)", padding: "20px 28px" }}>
            <Row label="Ticket number" value={registration.ticketNumber} />
            <Row label="Date" value={event ? formatRange(event.startsAt, event.endsAt) : "—"} />
            <Row label="Venue" value={venue ? `${venue.name}, ${venue.city}` : "—"} />
          </div>
          <div style={{ padding: "0 28px 28px" }}>
            <button type="button" className="nt-btn" style={{ width: "100%" }} onClick={() => window.print()}>
              Print ticket
            </button>
          </div>
        </article>

        <section className="nt-panel">
          <div className="nt-panel-header">
            <div>
              <p className="nt-kicker">Readiness</p>
              <h3>Registration status</h3>
            </div>
          </div>
          <div className="nt-row-list">
            <StateRow label="Registration" value={registration.status} />
            <StateRow label="Payment" value={payment?.status ?? "Not recorded"} />
            <StateRow label="Check-in" value={checkIn ? "Checked in" : "Not checked in"} />
          </div>
          <p className="nt-muted" style={{ lineHeight: 1.65, marginTop: 18 }}>
            If any detail looks incorrect, contact the event team before arriving at the venue.
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, padding: "9px 0" }}>
      <span className="nt-muted">{label}</span>
      <strong style={{ textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="nt-row-item">
      <div className="nt-row-main"><strong>{label}</strong><span>{value}</span></div>
    </div>
  );
}
