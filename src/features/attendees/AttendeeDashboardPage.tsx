import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { formatRange } from "../../lib/dates";
import { sessionsFor, venueOf } from "../../repositories/platform";

export function AttendeeDashboardPage() {
  const { db, attendeeId } = usePlatform();
  const me = db.attendees.find((item) => item.id === attendeeId);
  const regs = db.registrations.filter((item) => item.attendeeId === attendeeId && item.status !== "cancelled");
  const upcoming = db.events.find((event) => regs.some((reg) => reg.eventId === event.id) && event.status !== "completed");
  const history = db.events.filter((event) => regs.some((reg) => reg.eventId === event.id) && event.status === "completed");
  const saved = db.savedSessions.filter((item) => item.attendeeId === attendeeId);
  const unread = db.notifications.filter((item) => item.attendeeId === attendeeId && !item.read);
  const certs = db.certificates.filter((item) => item.attendeeId === attendeeId);
  const nextSession = upcoming
    ? sessionsFor(db, upcoming.id).find((session) => saved.some((item) => item.sessionId === session.id)) ?? sessionsFor(db, upcoming.id)[0]
    : undefined;
  const latestNotices = db.notifications.filter((item) => item.attendeeId === attendeeId).slice(0, 3);

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">My Neurotech events</p>
          <h1>Good day, {me?.fullName.split(" ")[0] ?? "there"}.</h1>
          <p className="nt-lede">Your next event, ticket readiness, saved sessions and attendance history in one place.</p>
        </div>
        <Link to="/events" className="nt-btn">Find another event</Link>
      </div>

      <div className="nt-mini-stat-grid">
        {[
          [String(regs.length), "Registrations"],
          [String(saved.length), "Saved sessions"],
          [String(unread.length), "Unread notices"],
          [String(certs.length), "Certificates"],
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
            <p className="nt-kicker" style={{ color: "#8ad356" }}>Next registered event</p>
            {upcoming ? (
              <>
                <h2>{upcoming.title}</h2>
                <div className="nt-priority-meta">
                  <span>{formatRange(upcoming.startsAt, upcoming.endsAt)}</span>
                  <span>{venueOf(db, upcoming.venueId)?.name ?? "Venue to be confirmed"}</span>
                </div>
                <div className="nt-actions">
                  <Link to="/app/ticket" className="nt-btn accent">Open my ticket</Link>
                  <Link to={`/events/${upcoming.slug}`} className="nt-btn ghost" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.22)" }}>
                    Event details
                  </Link>
                  <Link to="/app/schedule" className="nt-arrow-link" style={{ color: "#d8e3d1" }}>
                    My schedule →
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2>You have no upcoming registration yet.</h2>
                <div className="nt-priority-meta"><span>When you register, the event and ticket will appear here.</span></div>
                <Link to="/events" className="nt-btn accent">Browse events</Link>
              </>
            )}
          </section>

          <section className="nt-panel">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Event history</p>
                <h3>Previously attended and registered</h3>
              </div>
              <Link to="/app/certificates" className="nt-arrow-link">Certificates →</Link>
            </div>
            {history.length ? (
              <div className="nt-row-list">
                {history.slice(0, 5).map((event) => {
                  const registration = regs.find((item) => item.eventId === event.id);
                  return (
                    <div className="nt-row-item" key={event.id}>
                      <div className="nt-row-main">
                        <strong>{event.title}</strong>
                        <span>{formatRange(event.startsAt, event.endsAt)} · {venueOf(db, event.venueId)?.city ?? "Event"}</span>
                      </div>
                      <span className="nt-badge neutral">{registration?.status ?? "registered"}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="nt-empty" style={{ padding: 28 }}>Past Neurotech events connected to your account will appear here.</div>
            )}
          </section>
        </div>

        <div className="nt-dashboard-stack">
          <section className="nt-panel">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Up next</p>
                <h3>Saved session</h3>
              </div>
            </div>
            {nextSession ? (
              <>
                <div style={{ color: "#357830", font: "700 30px Manrope,sans-serif", marginBottom: 8 }}>{nextSession.startTime}</div>
                <h3 style={{ font: "700 19px Manrope,sans-serif", margin: "0 0 8px" }}>{nextSession.title}</h3>
                <p className="nt-muted" style={{ lineHeight: 1.6, margin: "0 0 18px" }}>
                  {nextSession.room} · {nextSession.speakerLabel}
                </p>
                <Link to="/app/schedule" className="nt-btn ghost">Open personal schedule</Link>
              </>
            ) : (
              <p className="nt-muted">Save sessions from an upcoming event schedule and your next one will appear here.</p>
            )}
          </section>

          <section className="nt-panel">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Notices</p>
                <h3>Event updates</h3>
              </div>
              <Link to="/app/notifications" className="nt-arrow-link">All notices →</Link>
            </div>
            {latestNotices.length ? (
              <div className="nt-row-list">
                {latestNotices.map((notice) => (
                  <div className="nt-row-item" key={notice.id}>
                    <div className="nt-row-main">
                      <strong>{notice.title}</strong>
                      <span>{notice.read ? "Read" : "Unread"}</span>
                    </div>
                    {!notice.read ? <span className="nt-badge ok">New</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="nt-muted">You are all caught up.</p>
            )}
          </section>

          <section className="nt-panel">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Account</p>
                <h3>Keep your details current</h3>
              </div>
            </div>
            <p className="nt-muted" style={{ lineHeight: 1.6 }}>
              Your profile connects registrations, tickets, networking preferences and certificates across Neurotech events.
            </p>
            <Link to="/app/profile" className="nt-btn ghost">Manage profile</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
