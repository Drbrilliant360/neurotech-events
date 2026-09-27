import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { CLIENTS, COMMUNITY_STATS, COMPANY, PRINCIPLES, PRODUCTS, SUPPORTERS } from "../../lib/company";
import { accountPathFor } from "../../lib/routes";
import { publicEvents } from "../../repositories/platform";

export function AboutPage() {
  const { db, role } = usePlatform();
  const accountPath = accountPathFor(role);
  const events = publicEvents(db);

  return (
    <div className="nt-container nt-page nt-info-page">
      <section className="nt-info-hero">
        <p className="nt-kicker">About Neurotech Africa</p>
        <h1>{COMPANY.tagline}.</h1>
        <p className="nt-lede">
          {COMPANY.name} builds practical AI and commerce infrastructure for African businesses from Dar es Salaam. The next African business stack will not start with a website. It starts where customers already are: in conversation.
        </p>
        <div className="nt-info-actions">
          <Link to="/events" className="nt-btn accent">Explore events</Link>
          <a href={COMPANY.website} target="_blank" rel="noreferrer" className="nt-btn ghost">Company website ↗</a>
        </div>
      </section>

      <section className="nt-info-grid" aria-label="Neurotech Africa at a glance">
        {PRODUCTS.filter((product) => "stat" in product).map((product) => (
          <article key={product.name}><strong>{"stat" in product ? product.stat : ""}</strong><span>{"statLabel" in product ? product.statLabel : ""}</span></article>
        ))}
      </section>

      <section className="nt-info-story">
        <div>
          <p className="nt-kicker">Our products</p>
          <h2>{COMPANY.mission}</h2>
        </div>
        <div className="nt-info-story-copy">
          {PRODUCTS.map((product) => (
            <p key={product.name}><strong>{product.name}</strong> · {product.kind}. {product.body}</p>
          ))}
        </div>
      </section>

      <section className="nt-info-principles">
        {PRINCIPLES.map(([title, body], index) => (
          <article key={title} className="nt-card">
            <span className="nt-info-index">0{index + 1}</span>
            <h3>{title}</h3>
            <p className="nt-muted">{body}</p>
          </article>
        ))}
      </section>

      <section className="nt-info-story">
        <div>
          <p className="nt-kicker">Neurotech Events</p>
          <h2>One home for every Neurotech Africa event.</h2>
        </div>
        <div className="nt-info-story-copy">
          <p>
            Discover summits, product workshops and Generative AI Tanzania meetups, register with one account and keep your tickets, schedule and certificates together. {events.length} events are published right now.
          </p>
          <p>
            The Generative AI Tanzania community has reached {COMMUNITY_STATS.map(([value, label]) => `${value} ${label}`).join(", ")}.
          </p>
          <Link to={accountPath} className="nt-arrow-link">Open my events →</Link>
        </div>
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
        <a href={`mailto:${COMPANY.email}?subject=Event%20partnership`} className="nt-btn accent">Talk to us about partnering</a>
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
            <p className="nt-kicker">Event partners</p>
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
          <div className="nt-empty"><strong>Event partners are announced with each programme.</strong><p className="nt-muted">Check the event pages for partner information as each programme is confirmed.</p></div>
        )}
      </section>

      <section style={{ marginTop: 48 }}>
        <div className="nt-section-heading">
          <div>
            <p className="nt-kicker">Working with Neurotech Africa</p>
            <h2>Teams that build with our products.</h2>
          </div>
        </div>
        <ul className="nt-partner-grid" style={{ listStyle: "none", padding: 0 }}>
          {CLIENTS.map((name) => (
            <li key={name} className="nt-card nt-partner-card">
              <span className="nt-partner-monogram" aria-hidden="true">{name.slice(0, 1)}</span>
              <h3>{name}</h3>
            </li>
          ))}
        </ul>
        <p className="nt-muted" style={{ marginTop: 24 }}>Neurotech Africa is supported by {SUPPORTERS.join(", ")}.</p>
      </section>
    </div>
  );
}

export function HelpPage() {
  const { db } = usePlatform();
  const phone = db.settings.contactPhone || COMPANY.phone;
  return (
    <div className="nt-container nt-page nt-info-page nt-help-page">
      <section className="nt-info-hero">
        <p className="nt-kicker">Help centre</p>
        <h1>Everything you need for a smoother event day.</h1>
        <p className="nt-lede">Start with your event page for its programme and ticket details. These answers cover the common things attendees need before they arrive.</p>
      </section>

      <section className="nt-help-grid">
        {[
          ["Registration and tickets", "Register from an event page, then find your ticket anytime in My events. Each registration stays with the account you used to register."],
          ["Schedules and updates", "Use the schedule to explore sessions before the event. Attendees can save sessions to their own agenda and receive notices in the attendee area."],
          ["Payments", "Paid tickets are settled by mobile money through Snippe (M-Pesa, Airtel Money, Mixx by Yas, HaloPesa). You approve the prompt on your phone and your ticket is issued once the payment is confirmed."],
          ["On the day", "Bring your ticket QR code and follow the guidance on your event page. Venue, session and check-in information can vary by event."],
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
          <p>Mention the event name so we have the right context. Our office is at {COMPANY.address}.</p>
        </div>
        <div className="nt-actions">
          <a href={`mailto:${db.settings.contactEmail}`} className="nt-btn accent">Email {db.settings.contactEmail}</a>
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="nt-btn ghost">Call {phone}</a>
        </div>
      </section>
    </div>
  );
}
