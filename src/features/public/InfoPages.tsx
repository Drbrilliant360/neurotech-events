import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { publicEvents } from "../../repositories/platform";

export function AboutPage() {
  const { db } = usePlatform();
  const events = publicEvents(db);

  return (
    <div className="nt-container nt-page nt-info-page">
      <section className="nt-info-hero">
        <p className="nt-kicker">About Neurotech Events</p>
        <h1>Events with more connection, and less friction.</h1>
        <p className="nt-lede">Neurotech Events is the shared home for Neurotech Africa experiences: the place to discover a programme, register, stay informed and return to the moments that moved your work forward.</p>
        <div className="nt-info-actions">
          <Link to="/events" className="nt-btn accent">Explore events</Link>
          <Link to="/app" className="nt-btn ghost">Open my events</Link>
        </div>
      </section>

      <section className="nt-info-grid" aria-label="Platform overview">
        <article><strong>{events.length}</strong><span>published experiences</span></article>
        <article><strong>{db.speakers.length}+</strong><span>speakers and facilitators</span></article>
        <article><strong>{db.venues.length}</strong><span>places to meet and learn</span></article>
      </section>

      <section className="nt-info-story">
        <div>
          <p className="nt-kicker">Designed around the attendee</p>
          <h2>From the first invitation to your event history.</h2>
        </div>
        <div className="nt-info-story-copy">
          <p>Every Neurotech Africa event has a clear path: discover what is happening, choose a ticket, keep your schedule close and arrive with the details you need.</p>
          <p>After the event, your account keeps its place in the story with tickets, notices and any certificates you become eligible to receive.</p>
        </div>
      </section>

      <section className="nt-info-principles">
        {[
          ["Discover clearly", "Straightforward event details, schedules and speaker line-ups before you commit."],
          ["Attend confidently", "One account keeps your registration, ticket and event updates together."],
          ["Keep the momentum", "Your event history makes it simple to reconnect with future Neurotech Africa experiences."],
        ].map(([title, body], index) => (
          <article key={title} className="nt-card">
            <span className="nt-info-index">0{index + 1}</span>
            <h3>{title}</h3>
            <p className="nt-muted">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export function PartnersPage() {
  const { db } = usePlatform();
  const sponsors = db.sponsors.filter((sponsor) => sponsor.active);

  return (
    <div className="nt-container nt-page nt-info-page">
      <section className="nt-info-hero nt-partners-hero">
        <p className="nt-kicker">Partnerships</p>
        <h1>Build the rooms where Africa&apos;s next ideas take shape.</h1>
        <p className="nt-lede">Neurotech Africa events bring product teams, institutions, operators and communities together around practical conversations and meaningful progress.</p>
        <Link to="/help" className="nt-btn accent">Talk to the events team</Link>
      </section>

      <section className="nt-partner-value">
        <div>
          <p className="nt-kicker">Why partner</p>
          <h2>More than a logo on a stage.</h2>
        </div>
        <div className="nt-partner-value-list">
          <span>Reach a community that is here to learn and build.</span>
          <span>Shape sessions that are useful to people in the room.</span>
          <span>Create an experience with a clear, consistent attendee journey.</span>
        </div>
      </section>

      <section>
        <div className="nt-section-heading">
          <div>
            <p className="nt-kicker">Current partners</p>
            <h2>Helping make the experience possible.</h2>
          </div>
        </div>
        {sponsors.length ? (
          <div className="nt-partner-grid">
            {sponsors.map((sponsor) => (
              <article key={sponsor.id} className="nt-card nt-partner-card">
                <span className="nt-partner-monogram" aria-hidden="true">{sponsor.name.slice(0, 1)}</span>
                <div>
                  <p className="nt-kicker">{sponsor.tier} partner</p>
                  <h3>{sponsor.name}</h3>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="nt-empty"><strong>Partner announcements are coming soon.</strong><p className="nt-muted">Check the event pages for partner information as each programme is confirmed.</p></div>
        )}
      </section>
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="nt-container nt-page nt-info-page nt-help-page">
      <section className="nt-info-hero">
        <p className="nt-kicker">Help centre</p>
        <h1>Everything you need for a smoother event day.</h1>
        <p className="nt-lede">Start with your event page for its programme and ticket details. These answers cover the common things attendees need before they arrive.</p>
      </section>

      <section className="nt-help-grid">
        {[
          ["Registration and tickets", "Register from an event page, then find your ticket anytime in My events. Each registration is kept with the attendee account used for the demo."],
          ["Schedules and updates", "Use the schedule to explore sessions before the event. Attendees can save sessions to their own agenda and receive notices in the attendee area."],
          ["Payments in this demo", "This prototype does not take real wallet, card or bank payments. Payment screens demonstrate the expected status flow only."],
          ["On the day", "Bring your ticket details and follow the event-specific guidance on your event page. Venue, session and check-in information can vary by event."],
        ].map(([title, body]) => (
          <article key={title} className="nt-card nt-help-card">
            <h3>{title}</h3>
            <p className="nt-muted">{body}</p>
          </article>
        ))}
      </section>

      <section className="nt-help-contact">
        <div>
          <p className="nt-kicker">Still need a hand?</p>
          <h2>Reach the events team.</h2>
          <p>For event-specific questions, use the contact path on the event page so the team has the right context.</p>
        </div>
        <Link to="/events" className="nt-btn accent">Find an event</Link>
      </section>
    </div>
  );
}
