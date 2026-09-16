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
    <div className="nt-shell">
      <DemoSwitcher />
      <header className="nt-header">
        <div className="nt-container nt-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <NavLink to="/" className="nt-brand">
              <span className="nt-mark" />
              <span className="nt-brand-name">NeuroTech Summit</span>
            </NavLink>
            <nav className="nt-nav" aria-label="Public">
              {NAV.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === "/"}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <NavLink to="/app" className="nt-muted">
              Attendee
            </NavLink>
            <NavLink to="/events" className="nt-btn">
              Get Started
            </NavLink>
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="nt-footer-bar">
        <div className="nt-container" style={{ padding: "56px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 34 }}>
          <div>
            <div style={{ font: "800 19px Manrope,sans-serif", color: "#fbfaf0", marginBottom: 10 }}>NeuroTech Summit</div>
            <div>Connecting minds with future technology. Dar es Salaam, Tanzania.</div>
          </div>
          <div>
            <div className="nt-kicker" style={{ color: "#8e9878" }}>Summit</div>
            <NavLink to="/events">Events</NavLink>
            <br />
            <NavLink to="/speakers">Speakers</NavLink>
            <br />
            <NavLink to="/schedule">Schedule</NavLink>
          </div>
          <div>
            <div className="nt-kicker" style={{ color: "#8e9878" }}>Participate</div>
            Become a speaker
            <br />
            Become a sponsor
            <br />
            Volunteer
          </div>
          <div>
            <div className="nt-kicker" style={{ color: "#8e9878" }}>Contact</div>
            hello@neurotech.co.tz
            <br />
            +255 22 212 3456
            <br />
            JNICC, Dar es Salaam
          </div>
        </div>
      </footer>
    </div>
  );
}
