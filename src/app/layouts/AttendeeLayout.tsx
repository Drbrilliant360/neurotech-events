import { NavLink, Outlet } from "react-router-dom";
import { usePlatform } from "../providers/PlatformProvider";
import { DemoSwitcher } from "./DemoSwitcher";

const NAV = [
  ["/app", "Dashboard"],
  ["/app/ticket", "My ticket"],
  ["/app/schedule", "My schedule"],
  ["/app/networking", "Networking"],
  ["/app/notifications", "Notifications"],
  ["/app/certificates", "Certificates"],
  ["/app/profile", "Profile"],
];

export function AttendeeLayout() {
  const { db, attendeeId } = usePlatform();
  const me = db.attendees.find((item) => item.id === attendeeId);
  const unread = db.notifications.filter((item) => item.attendeeId === attendeeId && !item.read).length;

  return (
    <div className="nt-shell">
      <DemoSwitcher />
      <nav className="mobile-nav" aria-label="Attendee">
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/app"} className="nt-chip">
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="nt-app">
        <aside className="nt-side">
          <div className="nt-brand" style={{ padding: "0 8px 26px" }}>
            <span className="nt-mark sm" />
            <strong>NeuroTech</strong>
          </div>
          <nav aria-label="Attendee">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/app"}>
                {label}
                {to === "/app/notifications" && unread ? ` (${unread})` : ""}
              </NavLink>
            ))}
          </nav>
          <div style={{ borderTop: "1px solid rgba(18,21,12,.08)", marginTop: 18, padding: 8 }}>
            <div style={{ fontWeight: 600 }}>{me?.fullName}</div>
            <div className="nt-muted">{me?.roleTitle}</div>
          </div>
        </aside>
        <div className="nt-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
