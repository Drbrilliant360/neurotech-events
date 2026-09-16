import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, MediaTile, StatusPill } from "../../components/shared/Widgets";
import { formatRange, isPast } from "../../lib/dates";
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
    <div className="nt-container nt-page" style={{ padding: "44px 24px 90px" }}>
      <h1>Events</h1>
      <div className="nt-toolbar">
        <input
          className="nt-search"
          value={query}
          placeholder="Search events…"
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
        <EmptyState title="No events match" body="Try another search or clear the filters." />
      ) : (
        <div className="nt-grid events">
          {filtered.map((event) => {
            const prices = ticketsFor(db, event.id).filter((ticket) => ticket.active).map((ticket) => ticket.price);
            return (
              <article key={event.id} className="nt-card">
                <div style={{ position: "relative" }}>
                  <MediaTile label={event.bannerLabel} height={172} />
                  <span className="nt-badge ok" style={{ position: "absolute", top: 12, left: 12, background: "#111510", color: "#fff" }}>
                    {event.bannerLabel}
                  </span>
                </div>
                <h3 style={{ marginTop: 14 }}>{event.title}</h3>
                <div className="nt-muted">
                  {formatRange(event.startsAt, event.endsAt)} · {venueOf(db, event.venueId)?.city}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "10px 0 12px" }}>
                  <span style={{ color: "#2f7d34", fontWeight: 600 }}>{fromLowestPrice(prices)}</span>
                  <StatusPill value={event.status} />
                </div>
                <Link to={`/events/${event.slug}`} className="nt-btn" style={{ width: "100%" }}>
                  View
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
