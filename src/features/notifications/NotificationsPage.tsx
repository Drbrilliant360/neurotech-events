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
    <div style={{ maxWidth: 700 }}>
      <h1>Notifications {unread ? `(${unread})` : ""}</h1>
      <div className="nt-toolbar">
        {CATS.map((item) => (
          <button key={item} type="button" className={`nt-chip ${cat === item ? "is-on" : ""}`} onClick={() => setCat(item)}>
            {item}
          </button>
        ))}
        <button type="button" className="nt-btn ghost" onClick={readAll}>
          Mark all read
        </button>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="nt-card"
          style={{ width: "100%", textAlign: "left", marginBottom: 10, opacity: item.read ? 0.7 : 1 }}
          onClick={() => readOne(item.id)}
        >
          <strong>{item.title}</strong>
          <div className="nt-muted">{item.body}</div>
          <div className="nt-muted">
            {item.category} · {formatDateTime(item.createdAt)} {item.read ? "" : "· unread"}
          </div>
        </button>
      ))}
    </div>
  );
}
