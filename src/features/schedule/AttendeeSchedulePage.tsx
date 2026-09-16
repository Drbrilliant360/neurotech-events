import { useMemo, useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { sessionsOverlap } from "../../lib/dates";
import { sessionsFor } from "../../repositories/platform";

export function AttendeeSchedulePage() {
  const { db, attendeeId, toggleAgenda } = usePlatform();
  const event = db.events.find((item) => item.featured) ?? db.events[0];
  const sessions = sessionsFor(db, event.id);
  const days = Array.from(new Set(sessions.map((session) => session.dayIndex))).sort();
  const [day, setDay] = useState(0);
  const [mine, setMine] = useState(false);
  const saved = db.savedSessions.filter((item) => item.attendeeId === attendeeId).map((item) => item.sessionId);
  const savedSet = new Set(saved);
  const items = useMemo(() => {
    return sessions.filter((session) => session.dayIndex === (days[day] ?? 0) && (!mine || saved.includes(session.id)));
  }, [sessions, days, day, mine, saved]);
  const savedSessions = sessions.filter((session) => savedSet.has(session.id));
  const overlaps = savedSessions.filter((session, index) =>
    savedSessions.some((other, otherIndex) => otherIndex !== index && sessionsOverlap(session, other)),
  );

  return (
    <div style={{ maxWidth: 820 }}>
      <h1>My schedule</h1>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {days.map((value, index) => (
          <button key={value} type="button" className={`nt-chip ${index === day ? "is-on" : ""}`} onClick={() => setDay(index)}>
            Day {value + 1}
          </button>
        ))}
        <button type="button" className={`nt-chip ${mine ? "is-on" : ""}`} onClick={() => setMine(!mine)}>
          Saved only
        </button>
      </div>
      {overlaps.length > 0 ? <p className="nt-muted">Some saved sessions overlap. Review times before event day.</p> : null}
      {items.map((session) => (
        <div key={session.id} className="nt-card" style={{ display: "grid", gridTemplateColumns: "86px minmax(0,1fr) auto", gap: 16, alignItems: "center", marginBottom: 10 }}>
          <strong style={{ color: "#2f7d34" }}>{session.startTime}</strong>
          <div>
            <div>{session.title}</div>
            <div className="nt-muted">
              {session.room} · {session.speakerLabel}
            </div>
          </div>
          <button type="button" className="nt-btn ghost" onClick={() => toggleAgenda(session.id)}>
            {savedSet.has(session.id) ? "Remove" : "Save"}
          </button>
        </div>
      ))}
    </div>
  );
}
