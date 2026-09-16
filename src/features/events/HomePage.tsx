import { Link } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { MediaTile } from "../../components/shared/Widgets";
import { formatRange } from "../../lib/dates";
import { fromLowestPrice } from "../../lib/money";
import { publicEvents, sponsorsForEvent, ticketsFor, venueOf } from "../../repositories/platform";

export function HomePage() {
  const { db } = usePlatform();
  const featured = db.events.find((event) => event.featured) ?? publicEvents(db)[0];
  const venue = featured ? venueOf(db, featured.venueId) : undefined;
  const speakers = db.speakers.slice(0, 4);
  const why = [
    ["01", "Learn", "Three tracks of research, clinical and engineering content."],
    ["02", "Network", "Meet peers across the region and beyond."],
    ["03", "Innovate", "Hands-on labs with real BCI and imaging hardware."],
    ["04", "Invest", "Roundtables with funds active in African health tech."],
    ["05", "Collaborate", "Find co-authors, clinical partners and pilot sites."],
  ];

  return (
    <div>
      <section className="nt-container nt-hero" style={{ padding: "40px 24px 80px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 56, alignItems: "center" }}>
        <div>
          <div className="nt-pill">
            <span className="nt-dot" />
            {featured ? `${formatRange(featured.startsAt, featured.endsAt)} · ${venue?.city}` : "Upcoming events"}
          </div>
          <h1 style={{ marginTop: 26 }}>
            Connecting Minds With <span style={{ fontWeight: 800 }}>Future</span> Technology
          </h1>
          <p className="nt-lede">
            Explore the future of neuroscience, AI, brain–computer interfaces and healthcare technology at East Africa's leading neurotechnology gathering.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 44 }}>
            {featured ? (
              <Link to={`/register/${featured.id}`} className="nt-btn">
                Register Now <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#8ad356", color: "#0d1a09" }}>→</span>
              </Link>
            ) : null}
            <Link to="/events" className="nt-btn ghost">
              Explore Events
            </Link>
          </div>
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            {[
              ["1,200+", "Attendees"],
              ["50+", "Speakers"],
              ["30+", "Sessions"],
            ].map(([value, label]) => (
              <div key={label}>
                <div style={{ font: "700 30px Manrope,sans-serif" }}>{value}</div>
                <div className="nt-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {["Keynote stage", "BCI workshop", "Research showcase", "Networking lounge"].map((label) => (
            <div key={label} className="nt-card">
              <MediaTile label={label} height={150} />
              <div style={{ paddingTop: 11 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {featured ? (
        <section style={{ background: "#fbfaf0", borderTop: "1px solid rgba(18,21,12,.07)", borderBottom: "1px solid rgba(18,21,12,.07)" }}>
          <div className="nt-container" style={{ padding: "64px 24px" }}>
            <p className="nt-kicker">Featured event</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 40, alignItems: "center" }}>
              <MediaTile label={`${featured.title} cover`} height={340} />
              <div>
                <h2 style={{ font: "700 clamp(30px,3.4vw,46px)/1.05 Manrope,sans-serif", margin: "0 0 18px" }}>{featured.title}</h2>
                <p className="nt-lede">{featured.description}</p>
                <Link to={`/events/${featured.slug}`} className="nt-btn">
                  View Event
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="nt-container" style={{ padding: "72px 24px" }}>
        <p className="nt-kicker">Explore by interest</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["Neuroscience", "AI & Brain Technology", "Brain Computer Interface", "Neurohealth", "Research", "Innovation", "Investment"].map((item) => (
            <Link key={item} to={`/events?q=${encodeURIComponent(item)}`} className="nt-chip" style={{ background: "#fff", padding: "14px 24px", fontSize: 15 }}>
              {item}
            </Link>
          ))}
        </div>
      </section>

      <section className="nt-container" style={{ padding: "0 24px 72px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <p className="nt-kicker">Featured speakers</p>
          <Link to="/speakers" className="nt-btn ghost">
            All speakers
          </Link>
        </div>
        <div className="nt-grid cards">
          {speakers.map((speaker) => (
            <article key={speaker.id} className="nt-card">
              <MediaTile label={speaker.initials} height={200} />
              <h3 style={{ marginTop: 16 }}>{speaker.name}</h3>
              <div style={{ color: "#2f7d34" }}>{speaker.role}</div>
              <div className="nt-muted">{speaker.organization}</div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ background: "#fbfaf0" }}>
        <div className="nt-container" style={{ padding: "72px 24px" }}>
          <h2 style={{ font: "700 40px/1.1 Manrope,sans-serif", margin: "0 0 34px" }}>Why attend?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 2, background: "rgba(18,21,12,.08)" }}>
            {why.map(([n, title, body]) => (
              <div key={n} style={{ background: "#fbfaf0", padding: "26px 22px 30px" }}>
                <div style={{ color: "#8ad356", marginBottom: 22 }}>{n}</div>
                <h3>{title}</h3>
                <p className="nt-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {featured ? (
        <section className="nt-container" style={{ padding: "72px 24px" }}>
          <p className="nt-kicker">Sponsors & partners</p>
          <div className="nt-grid cards">
            {sponsorsForEvent(db, featured.id).map((sponsor) => (
              <div key={sponsor.id} className="nt-card" style={{ minHeight: 92, display: "grid", placeItems: "center" }}>
                {sponsor.name}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="nt-container" style={{ padding: "0 24px 80px" }}>
        <div className="nt-cta">
          <h2>Ready to join the future?</h2>
          {featured ? (
            <Link to={`/register/${featured.id}`} className="nt-btn accent">
              Register for the Summit
            </Link>
          ) : (
            <Link to="/events" className="nt-btn accent">
              Explore events
            </Link>
          )}
        </div>
      </section>

      <section className="nt-container" style={{ padding: "0 24px 80px" }}>
        <p className="nt-kicker">Upcoming</p>
        <div className="nt-grid events">
          {publicEvents(db)
            .filter((event) => event.status !== "completed")
            .slice(0, 3)
            .map((event) => {
              const prices = ticketsFor(db, event.id).map((ticket) => ticket.price);
              const city = venueOf(db, event.venueId)?.city;
              return (
                <Link key={event.id} to={`/events/${event.slug}`} className="nt-card" style={{ color: "inherit" }}>
                  <MediaTile label={event.bannerLabel} height={150} />
                  <h3 style={{ marginTop: 12 }}>{event.title}</h3>
                  <div className="nt-muted">
                    {formatRange(event.startsAt, event.endsAt)} · {city}
                  </div>
                  <div style={{ color: "#2f7d34", marginTop: 8 }}>{fromLowestPrice(prices)}</div>
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}
