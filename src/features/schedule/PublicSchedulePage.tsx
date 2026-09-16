import { useMemo, useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { minutesBetween } from "../../lib/dates";
import { sessionsFor } from "../../repositories/platform";

export function PublicSchedulePage() {
  const { db, attendeeId, toggleAgenda } = usePlatform();
  const featured = db.events.find((event) => event.featured) ?? db.events[0];
  const sessions = sessionsFor(db, featured.id);
  const days = Array.from(new Set(sessions.map((session) => session.dayIndex))).sort();
  const [day, setDay] = useState(0);
  const [type, setType] = useState("all");
  const types = Array.from(new Set(sessions.map((session) => session.type)));
  const items = useMemo(
    () => sessions.filter((session) => session.dayIndex === (days[day] ?? 0) && (type === "all" || session.type === type)),
    [sessions, days, day, type],
  );
  const saved = new Set(db.savedSessions.filter((item) => item.attendeeId === attendeeId).map((item) => item.sessionId));

  return (
    <div className="nt-container nt-page" style={{ maxWidth: 1100, padding: "44px 24px 90px" }}>
      <h1>Schedule</h1>
      <p className="nt-lede">{featured.title}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {days.map((value, index) => {
          const sample = sessions.find((session) => session.dayIndex === value);
          return (
            <button key={value} type="button" className={`nt-chip ${index === day ? "is-on" : ""}`} onClick={() => setDay(index)}>
              {sample?.dayLabel} · {sample?.date.slice(5)}
            </button>
          );
        })}
        <select className="nt-chip" value={type} onChange={(e) => setType(e.target.value)} aria-label="Session type">
          <option value="all">All types</option>
          {types.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {items.map((session) => (
        <div key={session.id} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 24, padding: "22px 0", borderTop: "1px solid rgba(18,21,12,.12)" }}>
          <div style={{ font: "700 18px Manrope,sans-serif" }}>{session.startTime}</div>
          <div>
            <div style={{ font: "600 19px DM Sans,sans-serif" }}>{session.title}</div>
            <div className="nt-muted">
              {session.speakerLabel} · {session.room} · {session.type} · {minutesBetween(session.startTime, session.endTime)} min
            </div>
            <button type="button" className="nt-btn ghost" style={{ marginTop: 12 }} onClick={() => toggleAgenda(session.id)}>
              {saved.has(session.id) ? "Remove from my schedule" : "Add to my schedule"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
