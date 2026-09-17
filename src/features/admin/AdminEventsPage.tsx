import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { StatusPill } from "../../components/shared/Widgets";
import { formatRange } from "../../lib/dates";
import type { EventStatus } from "../../domain/types";

export function AdminEventsPage() {
  const { db, copyEvent, deleteEvent, saveEvent } = usePlatform();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | EventStatus>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const list = useMemo(
    () => db.events.filter((event) => {
      if (status !== "all" && event.status !== status) return false;
      return event.title.toLowerCase().includes(query.toLowerCase());
    }),
    [db.events, query, status],
  );

  const published = db.events.filter((event) => event.status === "published" || event.status === "ongoing").length;
  const totalRegistrations = db.registrations.filter((registration) => registration.status !== "cancelled").length;

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Event portfolio</p>
          <h1>Events</h1>
          <p className="nt-lede">Create, publish and operate Neurotech events from one structured workspace.</p>
        </div>
        <Link to="/admin/events/new" className="nt-btn accent">Create event</Link>
      </div>

      <div className="nt-mini-stat-grid">
        <div className="nt-mini-stat"><strong>{db.events.length}</strong><span>Total events</span></div>
        <div className="nt-mini-stat"><strong>{published}</strong><span>Live / published</span></div>
        <div className="nt-mini-stat"><strong>{totalRegistrations}</strong><span>Active registrations</span></div>
      </div>

      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search events…" onChange={(e) => setQuery(e.target.value)} />
        <select className="nt-chip" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Event status">
          <option value="all">All statuses</option>
          {["draft", "published", "ongoing", "completed", "cancelled"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="nt-table-wrap">
        <table className="nt-table">
          <thead>
            <tr><th>Event</th><th>Dates</th><th>Registrations</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {list.map((event) => (
              <tr key={event.id}>
                <td>
                  <strong>{event.title}</strong>
                  <div className="nt-muted">{event.category} · {event.format}</div>
                </td>
                <td>{formatRange(event.startsAt, event.endsAt)}</td>
                <td>{db.registrations.filter((item) => item.eventId === event.id && item.status !== "cancelled").length}</td>
                <td><StatusPill value={event.status} /></td>
                <td>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <Link to={`/admin/events/${event.id}`} className="nt-chip">Edit</Link>
                    <button type="button" className="nt-chip" onClick={() => saveEvent({ ...event, status: event.status === "published" ? "draft" : "published" })}>
                      {event.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button type="button" className="nt-chip" onClick={() => copyEvent(event.id)}>Duplicate</button>
                    <button type="button" className="nt-chip" onClick={() => setPendingId(event.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.length === 0 ? <div className="nt-empty" style={{ marginTop: 14 }}>No events match the current search and status filters.</div> : null}

      {pendingId ? (
        <div className="nt-dialog" role="alertdialog" aria-modal="true">
          <div className="nt-dialog-card">
            <p className="nt-kicker">Destructive action</p>
            <h2>Delete this event?</h2>
            <p className="nt-muted">This removes the event from local demo data. This action cannot be undone in the current session.</p>
            <div className="nt-actions">
              <button type="button" className="nt-btn danger" onClick={() => { deleteEvent(pendingId); setPendingId(null); }}>Delete event</button>
              <button type="button" className="nt-btn ghost" onClick={() => setPendingId(null)}>Keep event</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminEventFormPage({ mode, eventId }: { mode: "new" | "edit"; eventId?: string }) {
  const { db, saveEvent } = usePlatform();
  const navigate = useNavigate();
  const event = mode === "edit" ? db.events.find((item) => item.id === eventId) : undefined;
  const [title, setTitle] = useState(event?.title ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [theme, setTheme] = useState(event?.theme ?? "");
  const [venueId, setVenueId] = useState(event?.venueId ?? db.venues[0].id);
  const [capacity, setCapacity] = useState(String(event?.capacity ?? 200));
  const [startsAt, setStartsAt] = useState(event?.startsAt?.slice(0, 16) ?? "2027-04-01T09:00");
  const [endsAt, setEndsAt] = useState(event?.endsAt?.slice(0, 16) ?? "2027-04-01T17:00");
  const [error, setError] = useState("");

  function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    saveEvent({
      id: event?.id,
      title: title.trim(),
      slug,
      description,
      theme,
      venueId,
      capacity: Number(capacity) || 0,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      status: event?.status ?? "draft",
      subtitle: event?.subtitle ?? "",
      category: event?.category ?? "Summit",
      format: event?.format ?? "physical",
      registrationOpensAt: event?.registrationOpensAt ?? new Date().toISOString(),
      registrationClosesAt: event?.registrationClosesAt ?? new Date(endsAt).toISOString(),
      featured: event?.featured ?? false,
      bannerLabel: event?.bannerLabel ?? "Event",
      highlights: event?.highlights ?? [],
      faqs: event?.faqs ?? [],
    });
    navigate("/admin/events");
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">{mode === "new" ? "New event" : "Event configuration"}</p>
          <h1>{mode === "new" ? "Create event" : "Edit event"}</h1>
          <p className="nt-lede">Define the event identity, venue, capacity and operational dates before configuring tickets and programme content.</p>
        </div>
        <button type="button" className="nt-btn ghost" onClick={() => navigate("/admin/events")}>Back to events</button>
      </div>

      <section className="nt-panel">
        <div className="nt-panel-header"><div><p className="nt-kicker">Core details</p><h3>Event information</h3></div></div>
        <div className="nt-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
          <label className="nt-field"><span>Name</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="nt-field"><span>Slug</span><input value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
          <label className="nt-field" style={{ gridColumn: "1 / -1" }}><span>Description</span><textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="nt-field"><span>Theme</span><input value={theme} onChange={(e) => setTheme(e.target.value)} /></label>
          <label className="nt-field"><span>Venue</span><select value={venueId} onChange={(e) => setVenueId(e.target.value)}>{db.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
          <label className="nt-field"><span>Capacity</span><input value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
          <label className="nt-field"><span>Starts</span><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <label className="nt-field"><span>Ends</span><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="nt-actions" style={{ marginTop: 20 }}>
          <button type="button" className="nt-btn accent" onClick={submit}>Save event</button>
          <button type="button" className="nt-btn ghost" onClick={() => navigate("/admin/events")}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
