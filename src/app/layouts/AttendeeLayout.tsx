import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePlatform } from "../providers/PlatformProvider";
import { Icon } from "../../components/shared/Icon";
import { BrandLogo } from "../../components/shared/BrandLogo";
import { BottomNav, MobileDrawer, MobileTopBar, useDrawer, type NavItem } from "../../components/shared/MobileNav";

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: "home", end: true },
  { to: "/app/ticket", label: "My ticket", icon: "ticket" },
  { to: "/app/schedule", label: "My schedule", icon: "calendar" },
  { to: "/app/networking", label: "Networking", icon: "people" },
  { to: "/app/notifications", label: "Notifications", icon: "bell" },
  { to: "/app/certificates", label: "Certificates", icon: "award" },
  { to: "/app/profile", label: "Profile", icon: "user" },
];

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
  const { db, attendeeId, logout } = usePlatform();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const me = db.attendees.find((item) => item.id === attendeeId);
  const unread = db.notifications.filter((item) => item.attendeeId === attendeeId && !item.read).length;
  const withBadges = NAV.map((item) => (item.to === "/app/notifications" ? { ...item, badge: unread } : item));
  const primary = withBadges.filter((item) => ["/app", "/app/ticket", "/app/schedule", "/app/notifications"].includes(item.to));

  function handleLogout() {
    drawer.close();
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="nt-shell nt-surface-attendee">
      <MobileTopBar
        title="Neurotech Events"
        subtitle="Attendee workspace"
        homeTo="/app"
        menuOpen={drawer.open}
        onMenu={drawer.toggle}
        right={
          <NavLink to="/app/profile" className="nt-icon-btn" aria-label="Open profile">
            <Icon name="user" />
          </NavLink>
        }
      />

      <div className="nt-app">
        <aside className="nt-side">
          <NavLink to="/" className="nt-brand nt-side-brand" aria-label="Back to Neurotech Events">
            <BrandLogo compact />
            <span>
              <strong>Neurotech Events</strong>
              <small>Attendee workspace</small>
            </span>
          </NavLink>

          <div className="sec">Your event space</div>
          <nav aria-label="Attendee navigation">
            {withBadges.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <span>{item.label}</span>
                {item.badge ? <span className="nt-nav-count">{item.badge}</span> : null}
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

      <BottomNav items={primary} moreOpen={drawer.open} onMore={drawer.toggle} />
      <MobileDrawer
        open={drawer.open}
        onClose={drawer.close}
        heading={me?.fullName ?? "Attendee"}
        sections={[
          { title: "Your event space", items: withBadges },
          { title: "Explore", items: [{ to: "/events", label: "Browse events", icon: "calendar" }, { to: "/schedule", label: "Public programme", icon: "grid" }, { to: "/help", label: "Help centre", icon: "info" }] },
        ]}
        footer={
          <button type="button" className="nt-chip" onClick={handleLogout}>
            <Icon name="logout" size={16} /> Log out
          </button>
        }
      />
    </div>
  );
}
