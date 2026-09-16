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
    () =>
      db.events.filter((event) => {
        if (status !== "all" && event.status !== status) return false;
        return event.title.toLowerCase().includes(query.toLowerCase());
      }),
    [db.events, query, status],
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h1>Events</h1>
        <Link to="/admin/events/new" className="nt-btn">
          + Create event
        </Link>
      </div>
      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search events…" onChange={(e) => setQuery(e.target.value)} />
        <select className="nt-chip" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          {["draft", "published", "ongoing", "completed", "cancelled"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="nt-table-wrap">
        <table className="nt-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Dates</th>
              <th>Regs</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{formatRange(event.startsAt, event.endsAt)}</td>
                <td>{db.registrations.filter((item) => item.eventId === event.id).length}</td>
                <td>
                  <StatusPill value={event.status} />
                </td>
                <td>
                  <Link to={`/admin/events/${event.id}`}>Edit</Link>
                  {" · "}
                  <button
                    type="button"
                    className="nt-chip"
                    onClick={() =>
                      saveEvent({
                        ...event,
                        status: event.status === "published" ? "draft" : "published",
                      })
                    }
                  >
                    {event.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button type="button" className="nt-chip" onClick={() => copyEvent(event.id)}>
                    Duplicate
                  </button>
                  <button type="button" className="nt-chip" onClick={() => saveEvent({ ...event, status: "cancelled" })}>
                    Cancel
                  </button>
                  <button type="button" className="nt-chip" onClick={() => setPendingId(event.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pendingId ? (
        <div className="nt-dialog" role="alertdialog" aria-modal="true">
          <div className="nt-dialog-card">
            <h2>Delete this event?</h2>
            <p>This removes it from local demo data.</p>
            <button type="button" className="nt-btn danger" onClick={() => { deleteEvent(pendingId); setPendingId(null); }}>
              Delete
            </button>
            <button type="button" className="nt-btn ghost" onClick={() => setPendingId(null)}>
              Keep
            </button>
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
    <div style={{ maxWidth: 720 }}>
      <h1>{mode === "new" ? "Create event" : "Edit event"}</h1>
      <div className="nt-grid">
        <label className="nt-field">
          <span>Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Slug</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Description</span>
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Theme</span>
          <input value={theme} onChange={(e) => setTheme(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Venue</span>
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            {db.venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </label>
        <label className="nt-field">
          <span>Capacity</span>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Starts</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="nt-field">
          <span>Ends</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="button" className="nt-btn" onClick={submit}>
          Save
        </button>
      </div>
    </div>
  );
}
