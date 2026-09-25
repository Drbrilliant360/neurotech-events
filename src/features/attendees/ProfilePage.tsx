import { useState, type FormEvent } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function ProfilePage() {
  const { db, attendeeId, saveProfile, live, user } = usePlatform();
  const me = db.attendees.find((item) => item.id === attendeeId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    fullName: me?.fullName ?? "",
    phone: me?.phone ?? "",
    organization: me?.organization ?? "",
    jobTitle: me?.jobTitle ?? "",
    country: me?.country ?? "",
    interests: (me?.interests ?? []).join(", "),
  }));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!me) return null;

  const syncsToServer = live && Boolean(user);

  function startEdit() {
    setForm({ fullName: me!.fullName, phone: me!.phone, organization: me!.organization, jobTitle: me!.jobTitle, country: me!.country, interests: me!.interests.join(", ") });
    setStatus(null);
    setError(null);
    setEditing(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.fullName.trim().length < 2) return setError("Enter your full name.");
    const interests = form.interests.split(",").map((item) => item.trim()).filter(Boolean);
    const patch = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      organization: form.organization.trim(),
      jobTitle: form.jobTitle.trim(),
      country: form.country.trim(),
      interests,
    };
    setSaving(true);
    setError(null);
    // In live mode the provider saves to the API and surfaces server errors in its banner.
    const saved = await saveProfile(patch);
    setSaving(false);
    if (!saved) return setError("Could not save your profile.");
    setStatus(syncsToServer ? "Profile saved to your account." : "Profile saved in this browser.");
    setEditing(false);
  }

  return (
    <div className="nt-profile-page" style={{ maxWidth: 820, paddingTop: 0 }}>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Attendee account</p>
          <h1>Profile</h1>
          <p className="nt-lede">
            {syncsToServer
              ? "Your attendee identity across Neurotech Events. Changes are saved to your account."
              : "Your attendee identity across Neurotech Events. In demo mode this record is stored in this browser."}
          </p>
        </div>
        {!editing ? <button type="button" className="nt-btn" onClick={startEdit}>Edit profile</button> : null}
      </div>

      {status ? <p className="nt-auth-success" role="status" style={{ marginBottom: 16 }}>{status}</p> : null}

      {editing ? (
        <form className="nt-card nt-form-card" onSubmit={submit} noValidate>
          <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            {(
              [
                ["fullName", "Full name", "name"],
                ["phone", "Phone", "tel"],
                ["organization", "Organization", "organization"],
                ["jobTitle", "Job title", "organization-title"],
                ["country", "Country", "country-name"],
              ] as const
            ).map(([key, label, autoComplete]) => (
              <label key={key} className="nt-field">
                <span>{label}</span>
                <input value={form[key]} autoComplete={autoComplete} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
            <label className="nt-field" style={{ gridColumn: "1 / -1" }}>
              <span>Interests (comma-separated)</span>
              <input value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} placeholder="Neuroscience, BCI, AI" />
            </label>
          </div>
          <p className="nt-muted" style={{ marginTop: 8 }}>Email: {me.email}. Contact the events team to change the email on your account.</p>
          {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
          <div className="nt-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="nt-btn accent" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
            <button type="button" className="nt-btn ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="nt-card nt-profile-card">
          <div className="nt-profile-avatar">{initials(me.fullName)}</div>
          <div>
            <div className="nt-profile-meta">
              <strong>{me.fullName}</strong>
              <span className="nt-muted">{[me.jobTitle, me.organization].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="nt-profile-details">
              <div className="nt-profile-detail"><span>Email</span><strong>{me.email}</strong></div>
              <div className="nt-profile-detail"><span>Phone</span><strong>{me.phone || "—"}</strong></div>
              <div className="nt-profile-detail"><span>Organization</span><strong>{me.organization || "—"}</strong></div>
              <div className="nt-profile-detail"><span>Country</span><strong>{me.country || "—"}</strong></div>
            </div>
            <p className="nt-kicker" style={{ marginTop: 22 }}>Interests</p>
            <div className="nt-interest-list">
              {me.interests.length === 0 ? <span className="nt-muted">Add a few interests so other attendees can find you.</span> : null}
              {me.interests.map((interest) => <span key={interest} className="nt-chip">{interest}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
