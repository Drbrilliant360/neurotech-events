import { useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState } from "../../components/shared/Widgets";
import { sessionsOverlap } from "../../lib/dates";
import { sessionsFor } from "../../repositories/platform";

export function AttendeeSchedulePage() {
  const { db, attendeeId, toggleAgenda } = usePlatform();
  const registeredEventIds = new Set(
    db.registrations.filter((item) => item.attendeeId === attendeeId && item.status !== "cancelled").map((item) => item.eventId),
  );
  const myEvents = db.events.filter((item) => registeredEventIds.has(item.id));
  const candidates = myEvents.length > 0 ? myEvents : db.events.filter((item) => item.status === "published" || item.status === "ongoing");
  const [eventId, setEventId] = useState<string | null>(null);
  const event = candidates.find((item) => item.id === eventId) ?? candidates[0];
  const sessions = event ? sessionsFor(db, event.id) : [];
  const days = Array.from(new Set(sessions.map((session) => session.dayIndex))).sort();
  const [day, setDay] = useState(0);
  const [mine, setMine] = useState(false);
  const saved = db.savedSessions.filter((item) => item.attendeeId === attendeeId).map((item) => item.sessionId);
  const savedSet = new Set(saved);
  const items = sessions.filter((session) => session.dayIndex === (days[day] ?? 0) && (!mine || saved.includes(session.id)));
  const savedSessions = sessions.filter((session) => savedSet.has(session.id));
  const overlaps = savedSessions.filter((session, index) =>
    savedSessions.some((other, otherIndex) => otherIndex !== index && sessionsOverlap(session, other)),
  );

  if (!event) return <EmptyState title="No programme yet" body="Register for an event to build your personal agenda." />;

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Personal agenda</p>
          <h1>My schedule</h1>
          <p className="nt-lede">Build a focused event agenda, save sessions and quickly spot any timing conflicts.</p>
          {candidates.length > 1 ? (
            <label className="nt-field" style={{ maxWidth: 420 }}>
              <span>Event</span>
              <select value={event.id} onChange={(e) => setEventId(e.target.value)} aria-label="Choose event">
                {candidates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          ) : (
            <p className="nt-muted">{event.title}</p>
          )}
        </div>
        <span className="nt-pill"><span className="nt-dot" />{saved.length} saved</span>
      </div>

      <div className="nt-toolbar">
        {days.map((value, index) => (
          <button key={value} type="button" className={`nt-chip ${index === day ? "is-on" : ""}`} onClick={() => setDay(index)}>
            Day {value + 1}
          </button>
        ))}
        <button type="button" className={`nt-chip ${mine ? "is-on" : ""}`} onClick={() => setMine(!mine)}>
          {mine ? "Showing saved" : "Saved only"}
        </button>
      </div>

      {overlaps.length > 0 ? (
        <div className="nt-card" style={{ marginBottom: 16, borderColor: "rgba(154,116,28,.24)", background: "#fffaf0" }}>
          <strong>Schedule conflict detected</strong>
          <div className="nt-muted">Some saved sessions overlap. Review the session times before event day.</div>
        </div>
      ) : null}

      <section className="nt-panel">
        <div className="nt-panel-header">
          <div>
            <p className="nt-kicker">Day {Number(days[day] ?? 0) + 1}</p>
            <h3>{mine ? "Saved sessions" : "Full programme"}</h3>
          </div>
          <span className="nt-muted">{items.length} sessions</span>
        </div>

        <div className="nt-row-list">
          {items.map((session) => (
            <div key={session.id} className="nt-row-item" style={{ alignItems: "center" }}>
              <div style={{ minWidth: 76 }}>
                <strong style={{ color: "#4e9b3b", fontSize: 16 }}>{session.startTime}</strong>
                <div className="nt-muted">{session.endTime}</div>
              </div>
              <div className="nt-row-main">
                <strong>{session.title}</strong>
                <span>{session.room} · {session.speakerLabel}</span>
              </div>
              <button type="button" className={`nt-btn ${savedSet.has(session.id) ? "ghost" : ""}`} onClick={() => toggleAgenda(session.id)}>
                {savedSet.has(session.id) ? "Remove" : "Save"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
