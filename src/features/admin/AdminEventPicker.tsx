import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState } from "../../components/shared/Widgets";
import type { Event } from "../../domain/types";

export interface EditorProps {
  events: Event[];
  event: Event;
  setEventId: (id: string) => void;
}

/** The event an admin page operates on, remembered in the URL (`?event=`). */
export function useAdminEvent() {
  const { db } = usePlatform();
  const [params, setParams] = useSearchParams();
  const events = db.events;
  const requested = params.get("event");
  const event =
    events.find((item) => item.id === requested) ??
    events.find((item) => item.featured && item.status !== "completed") ??
    events.find((item) => item.status !== "completed") ??
    events[0];
  const setEventId = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("event", id);
    setParams(next, { replace: true });
  };
  return { events, event, setEventId };
}

export function AdminEventPicker({ events, event, onChange }: { events: Event[]; event: Event; onChange: (id: string) => void }) {
  return (
    <label className="nt-field" style={{ maxWidth: 440, marginBottom: 16 }}>
      <span>Event</span>
      <select value={event.id} onChange={(e) => onChange(e.target.value)} aria-label="Select the event to manage">
        {events.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
            {item.status === "completed" ? " (completed)" : item.status === "draft" ? " (draft)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NoEvents() {
  return (
    <div>
      <EmptyState title="No events yet" body="Create an event to configure tickets, programme, timeline, poster, communications and sponsors." />
      <Link to="/admin/events/new" className="nt-btn accent" style={{ marginTop: 16 }}>Create event</Link>
    </div>
  );
}

/** Renders an editor for the selected event, remounting it when the selection changes. */
export function ScopedAdminPage({ render }: { render: (scope: EditorProps) => ReactNode }) {
  const { events, event, setEventId } = useAdminEvent();
  if (!event) return <NoEvents />;
  return <>{render({ events, event, setEventId })}</>;
}
