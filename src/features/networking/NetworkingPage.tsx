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
    () =>
      db.networkingProfiles.filter((profile) => {
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
      <h1>Discover people</h1>
      <p className="nt-lede">Only mock public profile fields are shown. Connection state is local to this browser.</p>
      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search attendees…" onChange={(e) => setQuery(e.target.value)} />
        <select className="nt-chip" value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="Interest">
          <option value="all">All interests</option>
          {interests.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="nt-grid cards">
        {list.map((profile) => (
          <article key={profile.id} className="nt-card">
            <div className="nt-media" style={{ width: 52, height: 52, minHeight: 52, borderRadius: "50%" }}>
              {profile.initials}
            </div>
            <h3>{profile.publicName}</h3>
            <div style={{ color: "#2f7d34" }}>{profile.jobTitle}</div>
            <div className="nt-muted">{profile.organization}</div>
            <p>{profile.interests.join(" · ")}</p>
            <button type="button" className="nt-btn" style={{ width: "100%" }} onClick={() => toggleConnect(profile.attendeeId)}>
              {connected.has(profile.attendeeId) ? "Connected" : "Connect"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
