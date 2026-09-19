import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, StatusPill } from "../../components/shared/Widgets";
import { formatRange, isPast } from "../../lib/dates";
import { eventImage } from "../../lib/media";
import { fromLowestPrice } from "../../lib/money";
import { publicEvents, ticketsFor, venueOf } from "../../repositories/platform";

export function EventsPage() {
  const { db } = usePlatform();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [when, setWhen] = useState<"all" | "upcoming" | "past">("all");
  const [city, setCity] = useState("all");
  const [category, setCategory] = useState("all");

  const events = publicEvents(db);
  const cities = Array.from(new Set(events.map((event) => venueOf(db, event.venueId)?.city).filter(Boolean)));
  const categories = Array.from(new Set(events.map((event) => event.category)));

  const filtered = useMemo(() => {
    return events
      .filter((event) => {
        const hay = `${event.title} ${event.description} ${event.theme} ${event.category}`.toLowerCase();
        if (query && !hay.includes(query.toLowerCase())) return false;
        if (when === "upcoming" && isPast(event.endsAt)) return false;
        if (when === "past" && !isPast(event.endsAt) && event.status !== "completed") return false;
        if (city !== "all" && venueOf(db, event.venueId)?.city !== city) return false;
        if (category !== "all" && event.category !== category) return false;
        return true;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [events, query, when, city, category, db]);

  return (
    <div className="nt-container nt-page nt-directory-page">
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">Discover Neurotech Africa</p>
          <h1>Events built for learning, partnership and what comes next.</h1>
          <p className="nt-lede">
            Browse upcoming and past Neurotech Africa experiences, then filter by location, category or date to find the right room for you.
          </p>
        </div>
        <div className="nt-page-intro-stat">
          <strong>{filtered.length}</strong>
          <span>{filtered.length === 1 ? "event matches" : "events match"}</span>
        </div>
      </div>

      <div className="nt-toolbar nt-filter-bar">
        <input
          className="nt-search"
          value={query}
          placeholder="Search by event, theme or category…"
          aria-label="Search events"
          onChange={(e) => {
            setQuery(e.target.value);
            setParams(e.target.value ? { q: e.target.value } : {});
          }}
        />
        <select className="nt-chip" value={when} onChange={(e) => setWhen(e.target.value as typeof when)} aria-label="When">
          <option value="all">All dates</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
        <select className="nt-chip" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Location">
          <option value="all">All locations</option>
          {cities.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="nt-chip" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No events match" body="Try another search term or clear one of the filters." />
      ) : (
        <div className="nt-event-grid nt-directory-grid">
          {filtered.map((event, index) => {
            const venue = venueOf(db, event.venueId);
            const prices = ticketsFor(db, event.id).filter((ticket) => ticket.active).map((ticket) => ticket.price);
            return (
              <article key={event.id} className="nt-event-card">
                <Link to={`/events/${event.slug}`} className="nt-event-card-media nt-event-card-link" aria-label={`View ${event.title}`}>
                  <img src={eventImage(index)} alt="" />
                  <span className="nt-event-status">{event.status}</span>
                </Link>
                <div className="nt-event-card-body">
                  <div className="nt-event-meta">
                    <span>{formatRange(event.startsAt, event.endsAt)}</span>
                    <span>{venue?.city ?? "Venue TBA"}</span>
                  </div>
                  <h3>
                    <Link to={`/events/${event.slug}`}>{event.title}</Link>
                  </h3>
                  <p className="nt-event-summary">{event.description}</p>
                  <div className="nt-event-card-footer">
                    <div>
                      <span className="nt-event-price">{fromLowestPrice(prices)}</span>
                      <StatusPill value={event.category} />
                    </div>
                    <Link to={`/events/${event.slug}`} className="nt-arrow-link">
                      View event →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
