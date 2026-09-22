import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePlatform } from "../providers/PlatformProvider";

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
      ["/admin/transactions", "All transactions"],
      ["/admin/reports", "Reports"],
      ["/admin/settings", "Settings"],
    ],
  },
] as const;

export function AdminLayout() {
  const { db, logout } = usePlatform();
  const navigate = useNavigate();
  const activeEvent = db.events.find((event) => event.featured && event.status !== "completed") ?? db.events.find((event) => event.status !== "completed");

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="nt-shell nt-surface-admin">
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
          <NavLink to="/admin" className="nt-brand nt-side-brand" aria-label="Neurotech Events admin dashboard">
            <span className="nt-mark sm" />
            <span>
              <strong>Neurotech Events</strong>
              <small>Operations console</small>
            </span>
          </NavLink>

          {SECTIONS.map((sec) => (
            <div key={sec.title} className="nt-side-section">
              <div className="sec">{sec.title}</div>
              <nav aria-label={sec.title}>
                {sec.items.map(([to, label]) => (
                  <NavLink key={to} to={to} end={to === "/admin"}>
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}

          <div className="nt-side-footer admin-footer">
            <NavLink to="/" className="nt-side-explore">
              View public site →
            </NavLink>
            <div className="nt-admin-status">
              <span className="nt-status-dot" />
              <span>
                <strong>Operations workspace</strong>
                <small>Frontend demo environment</small>
              </span>
            </div>
          </div>
        </aside>

        <main className="nt-main">
          <div className="nt-workspace-topbar">
            <div className="nt-workspace-heading">
              <strong>Event operations</strong>
              <span>{activeEvent ? `Managing ${activeEvent.title}` : "Manage Neurotech Africa events and attendee operations."}</span>
            </div>
            <div className="nt-workspace-actions">
              <NavLink to="/admin/events/new" className="nt-btn accent nt-topbar-action">
                Create event
              </NavLink>
              <div className="nt-user-chip" aria-label="Administrator session">
                <span className="nt-user-avatar">NA</span>
                <span>
                  <strong>Neurotech Admin</strong>
                  <span>Event operations</span>
                </span>
              </div>
              <button type="button" className="nt-chip" onClick={handleLogout}>
                Log out
              </button>
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
