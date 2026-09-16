import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, MediaTile } from "../../components/shared/Widgets";
import { formatRange, minutesBetween } from "../../lib/dates";
import { fromLowestPrice } from "../../lib/money";
import { eventBySlug, sessionsFor, speakersForEvent, sponsorsForEvent, ticketsFor, venueOf } from "../../repositories/platform";

export function EventDetailPage() {
  const { eventId = "" } = useParams();
  const { db } = usePlatform();
  const event = eventBySlug(db, eventId);
  const [day, setDay] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const sessions = useMemo(() => (event ? sessionsFor(db, event.id) : []), [db, event]);
  const days = Array.from(new Set(sessions.map((session) => session.dayIndex))).sort();
  if (!event) return <div className="nt-container" style={{ padding: 48 }}><EmptyState title="Event not found" body="That event is unavailable or still a draft." /></div>;

  const venue = venueOf(db, event.venueId);
  const tickets = ticketsFor(db, event.id).filter((ticket) => ticket.active);
  const speakers = speakersForEvent(db, event.id);
  const dayItems = sessions.filter((session) => session.dayIndex === (days[day] ?? 0));
  const canRegister = event.status === "published" || event.status === "ongoing";

  return (
    <div className="nt-container nt-page" style={{ padding: "36px 24px 90px" }}>
      <MediaTile label={`${event.title} cover`} height={320} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(260px,340px)", gap: 44, marginTop: 34 }} className="event-detail-grid">
        <div>
          <h1>{event.title}</h1>
          <div className="nt-lede">
            {formatRange(event.startsAt, event.endsAt)} · {venue?.name}, {venue?.city}
          </div>
          <p className="nt-kicker">About the event</p>
          <p className="nt-lede">{event.description}</p>
          <p className="nt-kicker">Event highlights</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
            {event.highlights.map((item) => (
              <span key={item} className="nt-chip" style={{ background: "#fff" }}>
                {item}
              </span>
            ))}
          </div>
          <p className="nt-kicker">Speakers</p>
          <div className="nt-grid cards" style={{ marginBottom: 32 }}>
            {speakers.map((speaker) => (
              <div key={speaker.id} className="nt-card">
                <MediaTile label={speaker.initials} height={120} />
                <h3 style={{ marginTop: 12 }}>{speaker.name}</h3>
                <div className="nt-muted">{speaker.role}</div>
              </div>
            ))}
          </div>
          <p className="nt-kicker">Schedule preview</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {days.map((value, index) => (
              <button key={value} type="button" className={`nt-chip ${index === day ? "is-on" : ""}`} onClick={() => setDay(index)}>
                Day {value + 1}
              </button>
            ))}
          </div>
          <div className="nt-card" style={{ padding: 0, overflow: "hidden", marginBottom: 32 }}>
            {dayItems.map((session) => (
              <div key={session.id} style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr) auto", gap: 18, padding: "18px 22px", borderBottom: "1px solid rgba(18,21,12,.06)" }}>
                <strong style={{ color: "#2f7d34" }}>{session.startTime}</strong>
                <div>
                  <div>{session.title}</div>
                  <div className="nt-muted">
                    {session.speakerLabel} · {session.room} · {minutesBetween(session.startTime, session.endTime)} min
                  </div>
                </div>
                <span className="nt-badge neutral">{session.type}</span>
              </div>
            ))}
          </div>
          <p className="nt-kicker">Ticket packages</p>
          <div className="nt-grid" style={{ marginBottom: 32 }}>
            {tickets.map((ticket) => (
              <div key={ticket.id} className="nt-card" style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <strong>{ticket.name}</strong>
                  <div className="nt-muted">{ticket.perks}</div>
                </div>
                <div>{ticket.price === 0 ? "Free" : `TZS ${ticket.price.toLocaleString()}`}</div>
              </div>
            ))}
          </div>
          <p className="nt-kicker">Sponsors</p>
          <div className="nt-grid cards" style={{ marginBottom: 32 }}>
            {sponsorsForEvent(db, event.id).map((sponsor) => (
              <div key={sponsor.id} className="nt-card">
                {sponsor.name}
                <div className="nt-muted">{sponsor.tier}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
            <div>
              <p className="nt-kicker">Venue</p>
              <MediaTile label={venue?.name ?? "Venue"} height={190} />
              <p>
                {venue?.name}
                <br />
                {venue?.address}, {venue?.city}
              </p>
            </div>
            <div>
              <p className="nt-kicker">FAQ</p>
              {event.faqs.map((faq, index) => (
                <button
                  key={faq}
                  type="button"
                  className="nt-card"
                  style={{ width: "100%", textAlign: "left", marginBottom: 8 }}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  aria-expanded={openFaq === index}
                >
                  {faq} {openFaq === index ? "–" : "+"}
                  {openFaq === index ? <div className="nt-muted">Details will be confirmed closer to the event. Contact hello@neurotech.co.tz for specifics.</div> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
        <aside className="nt-card sticky-aside" style={{ position: "sticky", top: 96 }}>
          <h3>{event.title}</h3>
          <div className="nt-muted">Registration closes {formatRange(event.registrationClosesAt, event.registrationClosesAt)}</div>
          <div style={{ font: "700 34px Manrope,sans-serif", margin: "12px 0 20px" }}>{fromLowestPrice(tickets.map((ticket) => ticket.price))}</div>
          <div className="nt-muted" style={{ marginBottom: 16 }}>
            {venue?.city}, {venue?.country}
            <br />
            Capacity {event.capacity.toLocaleString()}
          </div>
          {canRegister ? (
            <Link to={`/register/${event.id}`} className="nt-btn" style={{ width: "100%", marginBottom: 10 }}>
              Register Now
            </Link>
          ) : (
            <p className="nt-muted">Registration is not open for this event.</p>
          )}
          <a className="nt-btn ghost" style={{ width: "100%" }} href={`/events/${event.slug}`}>
            Add to calendar
          </a>
        </aside>
      </div>
    </div>
  );
}
