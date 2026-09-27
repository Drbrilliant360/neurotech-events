import { useMemo, useState, type FormEvent } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";

function ProfileEditor() {
  const { db, attendeeId, saveNetworkingProfile, syncing, live } = usePlatform();
  const mine = db.networkingProfiles.find((item) => item.attendeeId === attendeeId);
  const attendee = db.attendees.find((item) => item.id === attendeeId);
  const [open, setOpen] = useState(!mine);
  const [form, setForm] = useState({
    publicName: mine?.publicName ?? attendee?.fullName ?? "",
    jobTitle: mine?.jobTitle ?? attendee?.jobTitle ?? "",
    organization: mine?.organization ?? attendee?.organization ?? "",
    interests: (mine?.interests ?? attendee?.interests ?? []).join(", "),
    bio: mine?.bio ?? "",
    visible: true,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await saveNetworkingProfile({
      public_name: form.publicName.trim(),
      job_title: form.jobTitle || null,
      organization: form.organization || null,
      interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean),
      bio: form.bio || null,
      is_visible: form.visible,
    });
    if (ok) setOpen(false);
  }

  if (!open) {
    return (
      <div className="nt-card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>
          {mine ? <>You appear as <strong>{mine.publicName}</strong>{mine.jobTitle ? ` · ${mine.jobTitle}` : ""}.</> : "You are not visible to other attendees."}
        </span>
        <button type="button" className="nt-btn ghost" onClick={() => setOpen(true)}>{mine ? "Edit my profile" : "Create my profile"}</button>
      </div>
    );
  }
  return (
    <form className="nt-card" style={{ marginBottom: 16 }} onSubmit={submit}>
      <h3>Your networking profile</h3>
      <p className="nt-muted" style={{ marginTop: 0 }}>
        Only people registered for the same events can see it{live ? "" : " (demo)"}. Your email and phone are never shown.
      </p>
      <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <label className="nt-field"><span>Display name</span><input required minLength={2} maxLength={200} value={form.publicName} onChange={(e) => setForm({ ...form, publicName: e.target.value })} /></label>
        <label className="nt-field"><span>Role</span><input maxLength={200} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></label>
        <label className="nt-field"><span>Organisation</span><input maxLength={200} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></label>
        <label className="nt-field"><span>Interests (comma-separated)</span><input value={form.interests} placeholder="AI agents, Payments" onChange={(e) => setForm({ ...form, interests: e.target.value })} /></label>
      </div>
      <label className="nt-field"><span>Short bio</span><textarea rows={2} maxLength={1000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
      <label className="nt-field"><span><input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} /> Show my profile to other attendees</span></label>
      <div className="nt-actions">
        <button type="submit" className="nt-btn" disabled={syncing}>Save profile</button>
        {mine ? <button type="button" className="nt-btn ghost" onClick={() => setOpen(false)}>Cancel</button> : null}
      </div>
    </form>
  );
}

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

      <ProfileEditor />

      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search by name, role or organization…" onChange={(e) => setQuery(e.target.value)} />
        <select className="nt-chip" value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="Interest">
          <option value="all">All interests</option>
          {interests.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <div className="nt-empty">
          {query || interest !== "all"
            ? "No attendees match those filters."
            : "No one to show yet. People appear here when they register for the same events as you and share a profile."}
        </div>
      ) : null}
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
