import { useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { formatDateTime } from "../../lib/dates";
import type { NotificationCategory } from "../../domain/types";

const CATS: Array<NotificationCategory | "all"> = ["all", "registration", "schedule", "reminder", "announcement", "payment", "certificate"];

export function NotificationsPage() {
  const { db, attendeeId, readOne, readAll } = usePlatform();
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const items = db.notifications
    .filter((item) => item.attendeeId === attendeeId && (cat === "all" || item.category === cat))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = items.filter((item) => !item.read).length;

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Inbox</p>
          <h1>Notifications</h1>
          <p className="nt-lede">Registration updates, schedule changes, reminders and event announcements in one place.</p>
        </div>
        <button type="button" className="nt-btn ghost" onClick={readAll}>Mark all read</button>
      </div>

      <div className="nt-mini-stat-grid" style={{ marginBottom: 18 }}>
        <div className="nt-mini-stat"><strong>{items.length}</strong><span>Visible notices</span></div>
        <div className="nt-mini-stat"><strong>{unread}</strong><span>Unread</span></div>
      </div>

      <div className="nt-toolbar">
        {CATS.map((item) => (
          <button key={item} type="button" className={`nt-chip ${cat === item ? "is-on" : ""}`} onClick={() => setCat(item)}>
            {item}
          </button>
        ))}
      </div>

      <section className="nt-panel">
        <div className="nt-row-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nt-row-item"
              style={{ width: "100%", textAlign: "left", background: item.read ? "transparent" : "#f5faF1", border: 0 }}
              onClick={() => readOne(item.id)}
            >
              <span style={{ width: 9, height: 9, borderRadius: 99, background: item.read ? "#cfd6ca" : "#77c94c", flex: "0 0 auto" }} />
              <div className="nt-row-main">
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
              <span className="nt-badge neutral">{item.category}</span>
            </button>
          ))}
          {items.length === 0 ? <div className="nt-empty">No notifications match this filter.</div> : null}
        </div>
      </section>
    </div>
  );
}
