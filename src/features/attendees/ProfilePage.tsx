import { usePlatform } from "../../app/providers/PlatformProvider";

export function ProfilePage() {
  const { db, attendeeId } = usePlatform();
  const me = db.attendees.find((item) => item.id === attendeeId);
  if (!me) return null;
  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Profile</h1>
      <p className="nt-lede">Demo attendee record stored in this browser. Not a production account.</p>
      <div className="nt-card">
        <p>
          <strong>{me.fullName}</strong>
          <br />
          {me.email}
          <br />
          {me.phone}
          <br />
          {me.jobTitle}, {me.organization}
          <br />
          {me.country}
        </p>
        <p className="nt-muted">Interests: {me.interests.join(", ")}</p>
      </div>
    </div>
  );
}
