import { NavLink, Outlet } from "react-router-dom";
import { usePlatform } from "../providers/PlatformProvider";

const NAV = [
  ["/app", "Dashboard"],
  ["/app/ticket", "My ticket"],
  ["/app/schedule", "My schedule"],
  ["/app/networking", "Networking"],
  ["/app/notifications", "Notifications"],
  ["/app/certificates", "Certificates"],
  ["/app/profile", "Profile"],
] as const;

function initials(name?: string) {
  if (!name) return "NE";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AttendeeLayout() {
  const { db, attendeeId } = usePlatform();
  const me = db.attendees.find((item) => item.id === attendeeId);
  const unread = db.notifications.filter((item) => item.attendeeId === attendeeId && !item.read).length;

  return (
    <div className="nt-shell nt-surface-attendee">
      <nav className="mobile-nav" aria-label="Attendee">
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/app"} className="nt-chip">
            {label}
            {to === "/app/notifications" && unread ? ` · ${unread}` : ""}
          </NavLink>
        ))}
      </nav>

      <div className="nt-app">
        <aside className="nt-side">
          <NavLink to="/" className="nt-brand nt-side-brand" aria-label="Back to Neurotech Events">
            <span className="nt-mark sm" />
            <span>
              <strong>Neurotech Events</strong>
              <small>Attendee workspace</small>
            </span>
          </NavLink>

          <div className="sec">Your event space</div>
          <nav aria-label="Attendee navigation">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/app"}>
                <span>{label}</span>
                {to === "/app/notifications" && unread ? <span className="nt-nav-count">{unread}</span> : null}
              </NavLink>
            ))}
          </nav>

          <div className="nt-side-footer">
            <NavLink to="/events" className="nt-side-explore">
              Explore more events →
            </NavLink>
            <div className="nt-side-profile">
              <span className="nt-user-avatar">{initials(me?.fullName)}</span>
              <span>
                <strong>{me?.fullName ?? "Attendee"}</strong>
                <small>{me?.roleTitle ?? me?.organization ?? "Neurotech attendee"}</small>
              </span>
            </div>
          </div>
        </aside>

        <main className="nt-main">
          <div className="nt-workspace-topbar">
            <div className="nt-workspace-heading">
              <strong>My event workspace</strong>
              <span>Tickets, schedules, notices and your Neurotech event history.</span>
            </div>
            <div className="nt-workspace-actions">
              <NavLink to="/events" className="nt-chip">
                Browse events
              </NavLink>
              <NavLink to="/app/profile" className="nt-user-chip" aria-label="Open attendee profile">
                <span className="nt-user-avatar">{initials(me?.fullName)}</span>
                <span>
                  <strong>{me?.fullName ?? "Attendee"}</strong>
                  <span>{me?.organization ?? "Neurotech Events"}</span>
                </span>
              </NavLink>
            </div>
          </div>
          <div className="nt-workspace-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
