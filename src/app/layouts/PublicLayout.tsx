import { NavLink, Outlet } from "react-router-dom";
import { usePlatform } from "../providers/PlatformProvider";
import { Icon } from "../../components/shared/Icon";
import { MobileDrawer, useDrawer } from "../../components/shared/MobileNav";
import { accountPathFor } from "../../lib/routes";

const NAV = [
  ["/", "Home"],
  ["/events", "Events"],
  ["/speakers", "Speakers"],
  ["/schedule", "Schedule"],
  ["/partners", "Partners"],
] as const;

export function PublicLayout() {
  const { role } = usePlatform();
  const accountPath = accountPathFor(role);
  const accountLabel = role === "attendee" ? "My events" : role === "admin" ? "Admin console" : "Sign in";
  const drawer = useDrawer();

  return (
    <div className="nt-shell nt-surface-public">
      <header className="nt-header">
        <div className="nt-container nt-header-row">
          <div className="nt-public-nav-cluster">
            <NavLink to="/" className="nt-brand" aria-label="Neurotech Events home">
              <span className="nt-mark" />
              <span className="nt-brand-copy">
                <span className="nt-brand-name">Neurotech Events</span>
                <span className="nt-brand-subtitle">by Neurotech Africa</span>
              </span>
            </NavLink>
            <nav className="nt-nav" aria-label="Public navigation">
              {NAV.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === "/"}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="nt-public-actions">
            <NavLink to={accountPath} className="nt-chip nt-account-link">
              {accountLabel}
            </NavLink>
            <NavLink to="/events" className="nt-btn">
              Browse events
            </NavLink>
            <button
              type="button"
              className="nt-icon-btn nt-menu-btn"
              aria-expanded={drawer.open}
              aria-controls="nt-mobile-drawer"
              aria-label={drawer.open ? "Close menu" : "Open menu"}
              onClick={drawer.toggle}
            >
              <Icon name={drawer.open ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawer.open}
        onClose={drawer.close}
        heading="Neurotech Events"
        sections={[
          {
            title: "Explore",
            items: [
              { to: "/", label: "Home", icon: "home", end: true },
              { to: "/events", label: "Events", icon: "calendar" },
              { to: "/speakers", label: "Speakers", icon: "mic" },
              { to: "/schedule", label: "Schedule", icon: "grid" },
              { to: "/partners", label: "Partners", icon: "handshake" },
            ],
          },
          {
            title: "Your account",
            items:
              role === "attendee"
                ? [
                    { to: "/app", label: "Dashboard", icon: "user", end: true },
                    { to: "/app/ticket", label: "My ticket", icon: "ticket" },
                    { to: "/app/certificates", label: "Certificates", icon: "award" },
                  ]
                : role === "admin"
                  ? [{ to: "/admin", label: "Admin console", icon: "cog", end: true }]
                  : [
                      { to: "/login", label: "Sign in", icon: "user" },
                      { to: "/register", label: "Create an account", icon: "spark" },
                    ],
          },
          {
            title: "Neurotech Africa",
            items: [
              { to: "/about", label: "About the platform", icon: "info" },
              { to: "/help", label: "Help centre", icon: "search" },
            ],
          },
        ]}
        footer={
          <NavLink to="/events" className="nt-btn" onClick={drawer.close}>
            Browse events
          </NavLink>
        }
      />

      <Outlet />

      <footer className="nt-footer-bar">
        <div className="nt-container nt-footer-inner">
          <div className="nt-footer-grid">
            <div className="nt-footer-intro">
              <div className="nt-footer-brand">
                <span className="nt-mark sm" />
                <div>
                  <strong>Neurotech Events</strong>
                  <span>by Neurotech Africa</span>
                </div>
              </div>
              <p>
                A single place to discover Neurotech Africa events, register, keep your ticket, follow the program and build a history of the experiences you attend.
              </p>
            </div>
            <div>
              <div className="nt-footer-heading">Explore</div>
              <NavLink to="/events">Events</NavLink>
              <NavLink to="/speakers">Speakers</NavLink>
              <NavLink to="/schedule">Schedule</NavLink>
              <NavLink to="/partners">Partners</NavLink>
            </div>
            <div>
              <div className="nt-footer-heading">Your account</div>
              <NavLink to={accountPath}>{role === "admin" ? "Admin console" : "Dashboard"}</NavLink>
              <NavLink to={role === "attendee" ? "/app/ticket" : "/login"}>Tickets</NavLink>
              <NavLink to={role === "attendee" ? "/app/certificates" : "/login"}>Certificates</NavLink>
            </div>
            <div>
              <div className="nt-footer-heading">Neurotech Africa</div>
              <NavLink to="/about">About the platform</NavLink>
              <NavLink to="/help">Help centre</NavLink>
              <a href="https://www.neurotech.africa" target="_blank" rel="noreferrer">Company website</a>
              <span className="nt-footer-location">Dar es Salaam, Tanzania</span>
            </div>
          </div>
          <div className="nt-footer-bottom">
            <span>Neurotech Events · Neurotech Africa</span>
            <span>Discovery · Registration · Attendance · Event history</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
