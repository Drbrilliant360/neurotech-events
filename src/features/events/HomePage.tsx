import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { formatRange } from "../../lib/dates";
import { MEDIA, eventImage, sceneImage } from "../../lib/media";
import { fromLowestPrice } from "../../lib/money";
import { publicEvents, ticketsFor, venueOf } from "../../repositories/platform";

export function HomePage() {
  const { db } = usePlatform();
  const visibleEvents = publicEvents(db);
  const upcomingEvents = visibleEvents.filter((event) => event.status !== "completed");
  const pastEvents = visibleEvents.filter((event) => event.status === "completed");
  const featured = db.events.find((event) => event.featured && event.status !== "completed") ?? upcomingEvents[0];
  const featuredVenue = featured ? venueOf(db, featured.venueId) : undefined;

  return (
    <div className="nt-public-home">
      <section className="nt-container nt-home-hero">
        <div className="nt-home-hero-grid">
          <div>
            <div className="nt-eyebrow">Neurotech Africa · Events</div>
            <h1 className="nt-home-title">
              Where Africa&apos;s technology community meets <em>what&apos;s next.</em>
            </h1>
            <p className="nt-home-copy">
              Discover Neurotech Africa workshops, product sessions, partner gatherings and community events. Register once, keep your tickets in one place and build a history of every event you attend with us.
            </p>
            <div className="nt-actions">
              {featured ? (
                <Link to={`/register/${featured.id}`} className="nt-btn accent">
                  Register for the next event →
                </Link>
              ) : null}
              <Link to="/events" className="nt-btn ghost">
                Explore all events
              </Link>
              <Link to="/app" className="nt-arrow-link">
                View my events →
              </Link>
            </div>
            <div className="nt-proof-row" aria-label="Platform benefits">
              <div className="nt-proof-item"><span className="nt-proof-icon">✓</span>One account across events</div>
              <div className="nt-proof-item"><span className="nt-proof-icon">✓</span>Tickets and event history</div>
              <div className="nt-proof-item"><span className="nt-proof-icon">✓</span>Schedules, notices and certificates</div>
            </div>
          </div>

          <div className="nt-feature-card" aria-label="Featured Neurotech event">
            <img src={MEDIA.cover} alt="Neurotech Africa event audience" />
            <div className="nt-feature-card-content">
              {featured ? (
                <>
                  <div className="nt-feature-date">
                    {formatRange(featured.startsAt, featured.endsAt)}{featuredVenue?.city ? ` · ${featuredVenue.city}` : ""}
                  </div>
                  <h2>{featured.title}</h2>
                  <p>{featured.description}</p>
                </>
              ) : (
                <>
                  <div className="nt-feature-date">Neurotech Events</div>
                  <h2>New events are being prepared.</h2>
                  <p>Explore the event archive or return when the next Neurotech Africa experience is published.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="nt-section soft">
        <div className="nt-container">
          <div className="nt-section-heading">
            <div>
              <p className="nt-kicker">Coming up</p>
              <h2>Choose the room you want to be in next.</h2>
              <p>Every event keeps the essentials clear: what it is, where it happens, when registration closes and what you need to attend.</p>
            </div>
            <Link to="/events" className="nt-btn ghost">See every event</Link>
          </div>

          {upcomingEvents.length ? (
            <div className="nt-event-grid">
              {upcomingEvents.slice(0, 3).map((event, index) => {
                const venue = venueOf(db, event.venueId);
                const prices = ticketsFor(db, event.id).map((ticket) => ticket.price);
                return (
                  <Link key={event.id} to={`/events/${event.slug}`} className="nt-event-card">
                    <div className="nt-event-card-media">
                      <img src={eventImage(index)} alt="" />
                      <span className="nt-event-status">Upcoming</span>
                    </div>
                    <div className="nt-event-card-body">
                      <div className="nt-event-meta">
                        <span>{formatRange(event.startsAt, event.endsAt)}</span>
                        <span>{venue?.city ?? "Event venue"}</span>
                      </div>
                      <h3>{event.title}</h3>
                      <div className="nt-event-card-footer">
                        <span className="nt-event-price">{fromLowestPrice(prices)}</span>
                        <span className="nt-arrow-link">View event →</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="nt-empty">There are no published upcoming events in the demo data yet.</div>
          )}
        </div>
      </section>

      <section className="nt-section dark">
        <div className="nt-container">
          <div className="nt-section-heading">
            <div>
              <p className="nt-kicker" style={{ color: "#8ad356" }}>Built for more than conferences</p>
              <h2>One event platform, multiple Neurotech experiences.</h2>
            </div>
          </div>
          <div className="nt-format-grid">
            {[
              ["01", "Product sessions", "Launches, live demos and deeper product conversations around Sarufi, SemaCall, Ghala and Snippe."],
              ["02", "Workshops", "Focused technical and business sessions with practical participation and limited-capacity registration."],
              ["03", "Partner events", "Sessions created with enterprises, institutions, banks, telcos and ecosystem partners."],
              ["04", "Community gatherings", "Meetups, talks and learning experiences that keep builders and operators connected."],
            ].map(([number, title, body]) => (
              <article key={number} className="nt-format-card">
                <div className="nt-format-number">{number}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nt-section">
        <div className="nt-container">
          <div className="nt-section-heading">
            <div>
              <p className="nt-kicker">Your event relationship</p>
              <h2>Registration should not disappear after the event ends.</h2>
              <p>Your attendee account is designed to retain tickets, notices, schedules, past attendance and certificates across Neurotech events.</p>
            </div>
            <Link to="/app" className="nt-btn">Open attendee dashboard</Link>
          </div>

          <div className="nt-history-strip">
            {(pastEvents.length ? pastEvents.slice(0, 3) : visibleEvents.slice(0, 3)).map((event, index) => (
              <Link key={event.id} to={`/events/${event.slug}`} className="nt-history-card">
                <img src={sceneImage(index)} alt="" />
                <div className="nt-history-card-content">
                  <small>{event.status === "completed" ? "Past event" : "Neurotech event"} · {formatRange(event.startsAt, event.endsAt)}</small>
                  <h3>{event.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="nt-container" style={{ padding: "0 24px 86px" }}>
        <div className="nt-platform-cta">
          <div>
            <p className="nt-kicker" style={{ color: "#8ad356" }}>Ready for the next one?</p>
            <h2>Find the next Neurotech Africa event and keep everything about your attendance in one account.</h2>
            <p>Browse what is coming up, register, access your ticket and return later to see the events you have attended.</p>
          </div>
          <div className="nt-cta-actions">
            <Link to="/events" className="nt-btn accent">Explore events</Link>
            <Link to="/app" className="nt-btn ghost" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.22)" }}>
              My events
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
