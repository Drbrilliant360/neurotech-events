import { NavLink, Outlet } from "react-router-dom";
import { DemoSwitcher } from "./DemoSwitcher";

const NAV = [
  ["/", "Home"],
  ["/events", "Events"],
  ["/speakers", "Speakers"],
  ["/schedule", "Schedule"],
] as const;

export function PublicLayout() {
  return (
    <div className="nt-shell nt-surface-public">
      <DemoSwitcher />
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
            <NavLink to="/app" className="nt-chip nt-account-link">
              My events
            </NavLink>
            <NavLink to="/events" className="nt-btn">
              Browse events
            </NavLink>
          </div>
        </div>
      </header>

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
            </div>
            <div>
              <div className="nt-footer-heading">Your account</div>
              <NavLink to="/app">Dashboard</NavLink>
              <NavLink to="/app/ticket">Tickets</NavLink>
              <NavLink to="/app/certificates">Certificates</NavLink>
            </div>
            <div>
              <div className="nt-footer-heading">Neurotech Africa</div>
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
