import { useMemo, useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";

export function NetworkingPage() {
  const { db, attendeeId, toggleConnect } = usePlatform();
  const [query, setQuery] = useState("");
  const [interest, setInterest] = useState("all");
  const interests = Array.from(new Set(db.networkingProfiles.flatMap((profile) => profile.interests)));
  const connected = new Set(
    db.connections
      .filter((item) => item.fromAttendeeId === attendeeId || item.toAttendeeId === attendeeId)
      .map((item) => (item.fromAttendeeId === attendeeId ? item.toAttendeeId : item.fromAttendeeId)),
  );
  const list = useMemo(
    () => db.networkingProfiles.filter((profile) => {
      if (profile.attendeeId === attendeeId) return false;
      const hay = `${profile.publicName} ${profile.organization} ${profile.jobTitle}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (interest !== "all" && !profile.interests.includes(interest)) return false;
      return true;
    }),
    [db.networkingProfiles, attendeeId, query, interest],
  );

  return (
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Event community</p>
          <h1>Discover people</h1>
          <p className="nt-lede">Find attendees by role, organization or shared interests, then build your event network.</p>
        </div>
        <span className="nt-pill"><span className="nt-dot" />{connected.size} connections</span>
      </div>

      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search by name, role or organization…" onChange={(e) => setQuery(e.target.value)} />
        <select className="nt-chip" value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="Interest">
          <option value="all">All interests</option>
          {interests.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="nt-grid cards">
        {list.map((profile) => (
          <article key={profile.id} className="nt-card">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div className="nt-media" style={{ width: 58, height: 58, minHeight: 58, borderRadius: "16px", fontSize: 16 }}>{profile.initials}</div>
              <div>
                <h3 style={{ marginBottom: 3 }}>{profile.publicName}</h3>
                <div className="nt-muted">{profile.organization}</div>
              </div>
            </div>
            <div style={{ color: "#4e9b3b", fontWeight: 700, marginBottom: 10 }}>{profile.jobTitle}</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
              {profile.interests.map((item) => <span key={item} className="nt-badge neutral">{item}</span>)}
            </div>
            <button type="button" className={`nt-btn ${connected.has(profile.attendeeId) ? "ghost" : ""}`} style={{ width: "100%" }} onClick={() => toggleConnect(profile.attendeeId)}>
              {connected.has(profile.attendeeId) ? "Disconnect" : "Connect"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
