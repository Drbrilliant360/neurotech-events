import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState } from "../../components/shared/Widgets";
import { minutesBetween } from "../../lib/dates";
import { sessionsFor } from "../../repositories/platform";

export function PublicSchedulePage() {
  const { db, attendeeId, role, toggleAgenda } = usePlatform();
  const navigate = useNavigate();
  const candidates = db.events.filter((event) => (event.status === "published" || event.status === "ongoing") && sessionsFor(db, event.id).length > 0);
  const [eventId, setEventId] = useState<string | null>(null);
  const featured = candidates.find((event) => event.id === eventId) ?? candidates.find((event) => event.featured) ?? candidates[0];
  const sessions = featured ? sessionsFor(db, featured.id) : [];
  const days = Array.from(new Set(sessions.map((session) => session.dayIndex))).sort();
  const [day, setDay] = useState(0);
  const [type, setType] = useState("all");
  const types = Array.from(new Set(sessions.map((session) => session.type)));
  const items = sessions.filter((session) => session.dayIndex === (days[day] ?? 0) && (type === "all" || session.type === type));
  const saved = new Set(db.savedSessions.filter((item) => item.attendeeId === attendeeId).map((item) => item.sessionId));
  const canSave = role === "attendee";

  if (!featured) {
    return (
      <div className="nt-container nt-page">
        <EmptyState title="Programme coming soon" body="Session schedules are published closer to each event." />
      </div>
    );
  }

  return (
    <div className="nt-container nt-page nt-directory-page nt-public-schedule">
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">Programme</p>
          <h1>Build your day around the sessions that matter.</h1>
          <p className="nt-lede">{featured.title} · Browse the programme by day and session type, then save sessions directly to your attendee schedule.</p>
        </div>
        <div className="nt-page-intro-stat">
          <strong>{items.length}</strong>
          <span>sessions in view</span>
        </div>
      </div>

      <div className="nt-schedule-toolbar">
        {candidates.length > 1 ? (
          <select className="nt-chip" value={featured.id} onChange={(e) => { setEventId(e.target.value); setDay(0); }} aria-label="Event">
            {candidates.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        ) : null}
        {days.map((value, index) => {
          const sample = sessions.find((session) => session.dayIndex === value);
          return (
            <button key={value} type="button" className={`nt-chip ${index === day ? "is-on" : ""}`} onClick={() => setDay(index)}>
              {sample?.dayLabel} · {sample?.date.slice(5)}
            </button>
          );
        })}
        <select className="nt-chip" value={type} onChange={(e) => setType(e.target.value)} aria-label="Session type">
          <option value="all">All session types</option>
          {types.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="nt-public-schedule-list">
        {items.map((session) => (
          <article key={session.id} className="nt-public-session">
            <div className="nt-public-session-time">{session.startTime}</div>
            <div>
              <div className="nt-public-session-title">{session.title}</div>
              <div className="nt-muted">{session.speakerLabel} · {session.room} · {session.type} · {minutesBetween(session.startTime, session.endTime)} min</div>
            </div>
            <button
              type="button"
              className={`nt-btn ${saved.has(session.id) && canSave ? "ghost" : ""}`}
              onClick={() => (canSave ? toggleAgenda(session.id) : navigate("/login"))}
            >
              {!canSave ? "Sign in to save" : saved.has(session.id) ? "Saved" : "Add to schedule"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
