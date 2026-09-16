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
            <NavLink to="/" className="nt-brand" aria-label="Neurotech Events home">
              <span className="nt-mark" />
              <span>
                <span className="nt-brand-name" style={{ display: "block", lineHeight: 1 }}>Neurotech Events</span>
                <span className="nt-muted" style={{ display: "block", marginTop: 3, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  by Neurotech Africa
                </span>
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
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <NavLink to="/app" className="nt-muted">
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
        <div className="nt-container" style={{ padding: "58px 24px 34px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,1.6fr) repeat(3,minmax(150px,.8fr))", gap: 34 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span className="nt-mark sm" />
                <div style={{ font: "800 19px Manrope,sans-serif", color: "#fbfaf0" }}>Neurotech Events</div>
              </div>
              <div style={{ maxWidth: 390, lineHeight: 1.6 }}>
                Events for the people building, operating and partnering around Africa&apos;s next technology infrastructure.
              </div>
            </div>
            <div>
              <div className="nt-kicker" style={{ color: "#8e9878" }}>Explore</div>
              <NavLink to="/events">Events</NavLink>
              <br />
              <NavLink to="/speakers">Speakers</NavLink>
              <br />
              <NavLink to="/schedule">Schedule</NavLink>
            </div>
            <div>
              <div className="nt-kicker" style={{ color: "#8e9878" }}>Your account</div>
              <NavLink to="/app">Dashboard</NavLink>
              <br />
              <NavLink to="/app/ticket">Tickets</NavLink>
              <br />
              <NavLink to="/app/certificates">Certificates</NavLink>
            </div>
            <div>
              <div className="nt-kicker" style={{ color: "#8e9878" }}>Neurotech Africa</div>
              <a href="https://www.neurotech.africa" target="_blank" rel="noreferrer">Company website</a>
              <br />
              Dar es Salaam, Tanzania
            </div>
          </div>
          <div style={{ marginTop: 44, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "#8e9878" }}>
            <span>Neurotech Events · Neurotech Africa</span>
            <span>Built for discovery, registration and event continuity.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
