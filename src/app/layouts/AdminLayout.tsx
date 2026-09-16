import { NavLink, Outlet } from "react-router-dom";
import { DemoSwitcher } from "./DemoSwitcher";

const SECTIONS = [
  { title: "Overview", items: [["/admin", "Dashboard"]] },
  {
    title: "Event management",
    items: [
      ["/admin/events", "Events"],
      ["/admin/events/new", "Create event"],
      ["/admin/tickets", "Tickets"],
    ],
  },
  {
    title: "Registration",
    items: [
      ["/admin/attendees", "Attendees"],
      ["/admin/check-in", "Check-in"],
    ],
  },
  {
    title: "Program",
    items: [
      ["/admin/schedule", "Schedule builder"],
      ["/admin/timeline", "Timeline"],
    ],
  },
  {
    title: "Marketing",
    items: [
      ["/admin/poster", "Poster designer"],
      ["/admin/communications", "Communications"],
      ["/admin/sponsors", "Sponsors"],
    ],
  },
  {
    title: "Finance & data",
    items: [
      ["/admin/payments", "Payments"],
      ["/admin/reports", "Reports"],
      ["/admin/settings", "Settings"],
    ],
  },
] as const;

export function AdminLayout() {
  return (
    <div className="nt-shell">
      <DemoSwitcher />
      <nav className="mobile-nav" aria-label="Admin">
        {SECTIONS.flatMap((sec) =>
          sec.items.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"} className="nt-chip">
              {label}
            </NavLink>
          )),
        )}
      </nav>
      <div className="nt-app">
        <aside className="nt-side admin">
          <div className="nt-brand" style={{ padding: "0 10px 24px" }}>
            <span className="nt-mark sm" />
            <strong style={{ color: "#fbfaf0", fontSize: 15 }}>NEUROTECH ADMIN</strong>
          </div>
          {SECTIONS.map((sec) => (
            <div key={sec.title} style={{ marginBottom: 16 }}>
              <div className="sec">{sec.title}</div>
              {sec.items.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === "/admin"}>
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>
        <div className="nt-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
