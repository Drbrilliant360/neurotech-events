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
      <h1>My ticket</h1>
      <article className="nt-ticket">
        <div style={{ background: "#111510", padding: 26, color: "#fbfaf0" }}>
          <div className="nt-kicker" style={{ color: "#9aa583" }}>{event?.title}</div>
          <div style={{ font: "700 24px Manrope,sans-serif", marginTop: 10 }}>{attendee?.fullName}</div>
          <div style={{ color: "#8ad356" }}>{ticket?.name} pass</div>
        </div>
        <div style={{ padding: 28, textAlign: "center" }}>
          <div className="nt-qr" role="img" aria-label={`Ticket pattern for ${registration.ticketNumber}`} />
          <div className="nt-muted">Frontend check-in pattern · payload is the public ticket number only</div>
        </div>
        <div style={{ borderTop: "1px dashed rgba(18,21,12,.18)", padding: "22px 28px" }}>
          <Row label="Ticket" value={registration.ticketNumber} />
          <Row label="Registration" value={registration.status} />
          <Row label="Payment" value={payment?.status ?? "—"} />
          <Row label="Check-in" value={checkIn ? "Checked in" : "Not checked in"} />
          <Row label="Date" value={event ? formatRange(event.startsAt, event.endsAt) : "—"} />
          <Row label="Venue" value={venue ? `${venue.name}, ${venue.city}` : "—"} />
        </div>
        <div style={{ padding: "0 28px 28px" }}>
          <button type="button" className="nt-btn" style={{ width: "100%" }} onClick={() => window.print()}>
            Print ticket
          </button>
        </div>
      </article>
      <p style={{ marginTop: 12 }}>
        <StatusPill value={registration.status} />
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
      <span className="nt-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
