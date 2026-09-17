import { usePlatform } from "../../app/providers/PlatformProvider";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function ProfilePage() {
  const { db, attendeeId } = usePlatform();
  const me = db.attendees.find((item) => item.id === attendeeId);
  if (!me) return null;

  return (
    <div className="nt-profile-page" style={{ maxWidth: 820, paddingTop: 0 }}>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Attendee account</p>
          <h1>Profile</h1>
          <p className="nt-lede">Your attendee identity across Neurotech Events. This demo record is stored locally in this browser.</p>
        </div>
      </div>

      <div className="nt-card nt-profile-card">
        <div className="nt-profile-avatar">{initials(me.fullName)}</div>
        <div>
          <div className="nt-profile-meta">
            <strong>{me.fullName}</strong>
            <span className="nt-muted">{me.jobTitle} · {me.organization}</span>
          </div>
          <div className="nt-profile-details">
            <div className="nt-profile-detail"><span>Email</span><strong>{me.email}</strong></div>
            <div className="nt-profile-detail"><span>Phone</span><strong>{me.phone}</strong></div>
            <div className="nt-profile-detail"><span>Organization</span><strong>{me.organization}</strong></div>
            <div className="nt-profile-detail"><span>Country</span><strong>{me.country}</strong></div>
          </div>
          <p className="nt-kicker" style={{ marginTop: 22 }}>Interests</p>
          <div className="nt-interest-list">
            {me.interests.map((interest) => <span key={interest} className="nt-chip">{interest}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
