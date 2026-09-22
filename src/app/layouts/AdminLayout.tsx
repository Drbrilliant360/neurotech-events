import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePlatform } from "../providers/PlatformProvider";
import { Icon } from "../../components/shared/Icon";
import { BottomNav, MobileDrawer, MobileTopBar, useDrawer, type NavItem, type NavSection } from "../../components/shared/MobileNav";
import { isLivePaymentsEnabled } from "../../services/payments";

const SECTIONS: NavSection[] = [
  { title: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: "grid", end: true }] },
  {
    title: "Event management",
    items: [
      { to: "/admin/events", label: "Events", icon: "calendar", end: true },
      { to: "/admin/events/new", label: "Create event", icon: "spark" },
      { to: "/admin/tickets", label: "Tickets", icon: "ticket" },
    ],
  },
  {
    title: "Registration",
    items: [
      { to: "/admin/attendees", label: "Attendees", icon: "people" },
      { to: "/admin/check-in", label: "Check-in", icon: "scan" },
    ],
  },
  {
    title: "Program",
    items: [
      { to: "/admin/schedule", label: "Schedule builder", icon: "calendar" },
      { to: "/admin/timeline", label: "Timeline", icon: "chart" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/poster", label: "Poster designer", icon: "spark" },
      { to: "/admin/communications", label: "Communications", icon: "bell" },
      { to: "/admin/sponsors", label: "Sponsors", icon: "handshake" },
    ],
  },
  {
    title: "Finance & data",
    items: [
      { to: "/admin/payments", label: "Payments", icon: "card" },
      ...(isLivePaymentsEnabled() ? [{ to: "/admin/transactions", label: "All transactions", icon: "card" } as NavItem] : []),
      { to: "/admin/reports", label: "Reports", icon: "chart" },
      { to: "/admin/settings", label: "Settings", icon: "cog" },
    ],
  },
];

const PRIMARY: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: "grid", end: true },
  { to: "/admin/events", label: "Events", icon: "calendar" },
  { to: "/admin/attendees", label: "Attendees", icon: "people" },
  { to: "/admin/check-in", label: "Check-in", icon: "scan" },
];

export function AdminLayout() {
  const { db, logout } = usePlatform();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const activeEvent = db.events.find((event) => event.featured && event.status !== "completed") ?? db.events.find((event) => event.status !== "completed");

  function handleLogout() {
    drawer.close();
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="nt-shell nt-surface-admin">
      <MobileTopBar
        title="Neurotech Events"
        subtitle="Operations console"
        homeTo="/admin"
        menuOpen={drawer.open}
        onMenu={drawer.toggle}
        right={
          <NavLink to="/admin/events/new" className="nt-icon-btn" aria-label="Create event">
            <Icon name="spark" />
          </NavLink>
        }
      />

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
                {sec.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}

          <div className="nt-side-footer admin-footer">
            <NavLink to="/events" className="nt-side-explore">
              View public site →
            </NavLink>
            <div className="nt-admin-status">
              <span className="nt-status-dot" />
              <span>
                <strong>Operations workspace</strong>
                <small>{isLivePaymentsEnabled() ? "Connected to the API" : "Frontend demo environment"}</small>
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

      <BottomNav items={PRIMARY} moreOpen={drawer.open} onMore={drawer.toggle} />
      <MobileDrawer
        open={drawer.open}
        onClose={drawer.close}
        heading="Operations console"
        sections={SECTIONS}
        footer={
          <>
            <NavLink to="/admin/events/new" className="nt-btn accent" onClick={drawer.close}>
              Create event
            </NavLink>
            <NavLink to="/events" className="nt-chip" onClick={drawer.close}>
              View public site
            </NavLink>
            <button type="button" className="nt-chip" onClick={handleLogout}>
              <Icon name="logout" size={16} /> Log out
            </button>
          </>
        }
      />
    </div>
  );
}
