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
  const items = useMemo(
    () => sessions.filter((session) => session.dayIndex === (days[day] ?? 0) && (!mine || saved.includes(session.id))),
    [sessions, days, day, mine, saved],
  );
  const savedSessions = sessions.filter((session) => savedSet.has(session.id));
  const overlaps = savedSessions.filter((session, index) =>
    savedSessions.some((other, otherIndex) => otherIndex !== index && sessionsOverlap(session, other)),
  );

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Personal agenda</p>
          <h1>My schedule</h1>
          <p className="nt-lede">Build a focused event agenda, save sessions and quickly spot any timing conflicts.</p>
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
