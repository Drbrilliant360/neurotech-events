import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { formatRange } from "../../lib/dates";
import { sessionsFor, venueOf } from "../../repositories/platform";

export function AttendeeDashboardPage() {
  const { db, attendeeId } = usePlatform();
  const me = db.attendees.find((item) => item.id === attendeeId);
  const regs = db.registrations.filter((item) => item.attendeeId === attendeeId && item.status !== "cancelled");
  const upcoming = db.events.find((event) => regs.some((reg) => reg.eventId === event.id && event.status !== "completed"));
  const saved = db.savedSessions.filter((item) => item.attendeeId === attendeeId);
  const unread = db.notifications.filter((item) => item.attendeeId === attendeeId && !item.read);
  const certs = db.certificates.filter((item) => item.attendeeId === attendeeId);
  const nextSession = upcoming
    ? sessionsFor(db, upcoming.id).find((session) => saved.some((item) => item.sessionId === session.id)) ?? sessionsFor(db, upcoming.id)[0]
    : undefined;
  const suggestions = db.networkingProfiles.filter((profile) => profile.attendeeId !== attendeeId).slice(0, 3);

  return (
    <div>
      <h1>Good day, {me?.fullName.split(" ")[0]}</h1>
      <p className="nt-lede">Your NeuroTech companion for upcoming sessions, tickets and people.</p>
      <div className="nt-grid stats" style={{ marginBottom: 28 }}>
        {[
          [String(regs.length), "Registrations"],
          [String(saved.length), "Saved sessions"],
          [String(unread.length), "Unread notices"],
          [String(certs.length), "Certificates"],
        ].map(([value, label]) => (
          <div key={label} className="nt-card">
            <div style={{ font: "700 34px Manrope,sans-serif" }}>{value}</div>
            <div className="nt-muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        <div className="nt-card" style={{ background: "#111510", color: "#fbfaf0" }}>
          <div className="nt-kicker" style={{ color: "#9aa583" }}>Upcoming event</div>
          <h2>{upcoming?.title ?? "No upcoming event"}</h2>
          {upcoming ? (
            <>
              <p>
                {formatRange(upcoming.startsAt, upcoming.endsAt)}
                <br />
                {venueOf(db, upcoming.venueId)?.name}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link to={`/events/${upcoming.slug}`} className="nt-btn accent">
                  View event
                </Link>
                <Link to="/app/ticket" className="nt-btn ghost" style={{ color: "#fbfaf0", background: "transparent" }}>
                  My ticket
                </Link>
              </div>
            </>
          ) : (
            <Link to="/events" className="nt-btn accent">
              Browse events
            </Link>
          )}
        </div>
        <div className="nt-card">
          <div className="nt-kicker">Next saved session</div>
          {nextSession ? (
            <>
              <div style={{ font: "700 30px Manrope,sans-serif", color: "#2f7d34" }}>{nextSession.startTime}</div>
              <h3>{nextSession.title}</h3>
              <p className="nt-muted">
                {nextSession.room} · {nextSession.speakerLabel}
              </p>
              <Link to="/app/schedule" className="nt-btn ghost">
                Personal schedule
              </Link>
            </>
          ) : (
            <p className="nt-muted">Save sessions from the public schedule.</p>
          )}
        </div>
      </div>
      <div style={{ marginTop: 24 }} className="nt-card">
        <div className="nt-kicker">Networking suggestions</div>
        {suggestions.map((profile) => (
          <div key={profile.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(18,21,12,.06)" }}>
            <span>
              {profile.publicName} · {profile.organization}
            </span>
            <Link to="/app/networking">Open</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
