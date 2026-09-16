import { NavLink, useNavigate } from "react-router-dom";
import { usePlatform } from "../providers/PlatformProvider";
import type { DemoRole } from "../../domain/types";

export function DemoSwitcher() {
  const { role, setRole, resetDemo, db } = usePlatform();
  const navigate = useNavigate();

  function switchRole(next: DemoRole) {
    setRole(next);
    if (next === "admin") navigate("/admin");
    else if (next === "attendee") navigate("/app");
    else navigate("/");
  }
  const unread = db.notifications.filter((item) => !item.read && item.attendeeId).length;

  return (
    <div className="nt-demo">
      <div className="nt-demo-inner">
        <div className="nt-brand">
          <div className="nt-mark sm" />
          <strong>NeuroTech</strong>
        </div>
        <div className="nt-seg" role="group" aria-label="Demo experience">
          <button type="button" className={role === "visitor" ? "is-on" : ""} onClick={() => switchRole("visitor")}>
            Public site
          </button>
          <button type="button" className={role === "attendee" ? "is-on" : ""} onClick={() => switchRole("attendee")}>
            Attendee{unread ? ` (${unread})` : ""}
          </button>
          <button type="button" className={role === "admin" ? "is-on" : ""} onClick={() => switchRole("admin")}>
            Admin
          </button>
        </div>
        <p className="nt-muted" style={{ margin: 0, flex: 1 }}>
          Demo identity only — not production authentication.
        </p>
        <button type="button" className="nt-chip" onClick={resetDemo}>
          Reset demo data
        </button>
        <NavLink to="/" className="nt-chip">
          Home
        </NavLink>
      </div>
    </div>
  );
}
