import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, MediaTile } from "../../components/shared/Widgets";
import { formatRange, minutesBetween } from "../../lib/dates";
import { MEDIA, eventImage, speakerImageById } from "../../lib/media";
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
    <div className="nt-container nt-page nt-detail-page">
      <div className="nt-detail-hero">
        <MediaTile
          label={`${event.title} cover`}
          height={350}
          src={eventImage(Math.abs(event.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)))}
        />
      </div>

      <div className="nt-detail-layout">
        <main className="nt-detail-content">
          <p className="nt-kicker">{event.category} · {event.status}</p>
          <h1>{event.title}</h1>
          <p className="nt-lede">
            {formatRange(event.startsAt, event.endsAt)} · {venue?.name}, {venue?.city}
          </p>

          <section className="nt-section-block">
            <p className="nt-kicker">About the event</p>
            <p className="nt-lede">{event.description}</p>
            <div className="nt-inline-tags">
              {event.highlights.map((item) => (
                <span key={item} className="nt-chip">{item}</span>
              ))}
            </div>
          </section>

          <section className="nt-section-block">
            <p className="nt-kicker">Featured speakers</p>
            <div className="nt-grid cards">
              {speakers.map((speaker) => (
                <article key={speaker.id} className="nt-card">
                  <MediaTile label={speaker.name} height={130} src={speakerImageById(speaker.id)} />
                  <h3 style={{ marginTop: 14 }}>{speaker.name}</h3>
                  <div className="nt-muted">{speaker.role}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="nt-section-block">
            <div className="nt-panel-header">
              <div>
                <p className="nt-kicker">Schedule preview</p>
                <h3>Plan the sessions that matter to you.</h3>
              </div>
              <div className="nt-inline-tags">
                {days.map((value, index) => (
                  <button key={value} type="button" className={`nt-chip ${index === day ? "is-on" : ""}`} onClick={() => setDay(index)}>
                    Day {value + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="nt-schedule-list">
              {dayItems.map((session) => (
                <div key={session.id} className="nt-schedule-row">
                  <span className="nt-schedule-time">{session.startTime}</span>
                  <div>
                    <div className="nt-schedule-title">{session.title}</div>
                    <div className="nt-muted">{session.speakerLabel} · {session.room} · {minutesBetween(session.startTime, session.endTime)} min</div>
                  </div>
                  <span className="nt-badge neutral">{session.type}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="nt-section-block">
            <p className="nt-kicker">Ticket options</p>
            <div className="nt-grid">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="nt-card nt-ticket-option">
                  <div>
                    <h3>{ticket.name}</h3>
                    <div className="nt-muted">{ticket.perks}</div>
                  </div>
                  <div className="nt-ticket-option-price">{ticket.price === 0 ? "Free" : `TZS ${ticket.price.toLocaleString()}`}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="nt-section-block">
            <p className="nt-kicker">Partners and sponsors</p>
            <div className="nt-grid cards">
              {sponsorsForEvent(db, event.id).map((sponsor) => (
                <div key={sponsor.id} className="nt-card">
                  <h3>{sponsor.name}</h3>
                  <div className="nt-muted">{sponsor.tier}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="nt-section-block nt-grid cards">
            <div>
              <p className="nt-kicker">Venue</p>
              <div className="nt-card">
                <MediaTile label={venue?.name ?? "Venue"} height={190} src={MEDIA.venue} />
                <h3 style={{ marginTop: 14 }}>{venue?.name}</h3>
                <div className="nt-muted">{venue?.address}, {venue?.city}</div>
              </div>
            </div>
            <div>
              <p className="nt-kicker">Frequently asked questions</p>
              {event.faqs.map((faq, index) => (
                <button
                  key={faq}
                  type="button"
                  className="nt-card"
                  style={{ width: "100%", textAlign: "left", marginBottom: 8 }}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  aria-expanded={openFaq === index}
                >
                  <strong>{faq} {openFaq === index ? "–" : "+"}</strong>
                  {openFaq === index ? <div className="nt-muted" style={{ marginTop: 8 }}>Details will be confirmed closer to the event. Contact hello@neurotech.co.tz for specifics.</div> : null}
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="nt-card nt-detail-sidebar nt-sticky-card">
          <p className="nt-kicker">Registration</p>
          <h3>{event.title}</h3>
          <div className="nt-muted">Registration closes {formatRange(event.registrationClosesAt, event.registrationClosesAt)}</div>
          <div className="nt-sticky-card-price">{fromLowestPrice(tickets.map((ticket) => ticket.price))}</div>
          <div className="nt-sticky-card-meta">
            {venue?.city}, {venue?.country}
            <br />
            Capacity {event.capacity.toLocaleString()}
          </div>
          {canRegister ? (
            <Link to={`/register/${event.id}`} className="nt-btn" style={{ width: "100%", marginBottom: 10 }}>Register now</Link>
          ) : (
            <p className="nt-muted">Registration is not open for this event.</p>
          )}
          <a className="nt-btn ghost" style={{ width: "100%" }} href={`/events/${event.slug}`}>Add to calendar</a>
        </aside>
      </div>
    </div>
  );
}
