import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import type { Speaker, Venue } from "../../domain/types";
import { TBA_VENUE_ID } from "../../repositories/remote";
import { ApiError } from "../../services/api";
import * as api from "../../services/platformApi";

function ConfirmDelete({ label, onOk, onCancel }: { label: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div className="nt-dialog" role="alertdialog" aria-modal="true" aria-labelledby="nt-confirm-title">
      <div className="nt-dialog-card">
        <h2 id="nt-confirm-title">Remove {label}?</h2>
        <button type="button" className="nt-btn danger" onClick={onOk}>Remove</button>
        <button type="button" className="nt-btn ghost" onClick={onCancel} autoFocus>Keep</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ speakers

const EMPTY_SPEAKER = { name: "", role: "", organization: "", track: "", bio: "", socialUrl: "" };

export function AdminSpeakersPage() {
  const { db, saveSpeaker, deleteSpeaker, live, syncing } = usePlatform();
  const [form, setForm] = useState<typeof EMPTY_SPEAKER & { id?: string }>(EMPTY_SPEAKER);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Speaker | null>(null);
  const speakers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return db.speakers
      .filter((item) => !needle || `${item.name} ${item.organization} ${item.track}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db.speakers, query]);
  const sessionCount = (id: string) => db.sessions.filter((item) => item.speakerId === id).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return;
    const ok = await saveSpeaker({ ...form, socialUrl: form.socialUrl || undefined });
    if (ok) setForm(EMPTY_SPEAKER);
  }

  const field = (key: keyof typeof EMPTY_SPEAKER, label: string, props: Record<string, unknown> = {}) => (
    <label className="nt-field">
      <span>{label}</span>
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <div>
      <h1>Speakers</h1>
      <p className="nt-lede">
        The shared speaker directory. Speakers linked to sessions appear on the public speakers page and event programmes
        {live ? "; changes are saved to the server." : "."}
      </p>
      <form className="nt-card" style={{ marginBottom: 16, maxWidth: 760 }} onSubmit={submit}>
        <h3>{form.id ? "Edit speaker" : "Add speaker"}</h3>
        <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {field("name", "Full name", { required: true, minLength: 2, maxLength: 200 })}
          {field("role", "Role or title", { maxLength: 200 })}
          {field("organization", "Organisation", { maxLength: 200 })}
          {field("track", "Track", { maxLength: 120, placeholder: "e.g. AI agents" })}
          {field("socialUrl", "Profile link (https)", { type: "url", placeholder: "https://" })}
        </div>
        <label className="nt-field">
          <span>Short bio</span>
          <textarea rows={3} maxLength={5000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </label>
        <div className="nt-actions">
          <button type="submit" className="nt-btn" disabled={syncing}>{form.id ? "Save changes" : "Add speaker"}</button>
          {form.id ? <button type="button" className="nt-btn ghost" onClick={() => setForm(EMPTY_SPEAKER)}>Cancel</button> : null}
        </div>
      </form>

      <div className="nt-toolbar">
        <input className="nt-search" value={query} placeholder="Search speakers…" aria-label="Search speakers" onChange={(e) => setQuery(e.target.value)} />
      </div>
      {speakers.length ? (
        <div className="nt-table-wrap">
          <table className="nt-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Track</th><th>Sessions</th><th><span className="nt-sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {speakers.map((speaker) => (
                <tr key={speaker.id}>
                  <td><strong>{speaker.name}</strong><div className="nt-muted">{speaker.organization}</div></td>
                  <td>{speaker.role || "—"}</td>
                  <td>{speaker.track || "—"}</td>
                  <td>{sessionCount(speaker.id)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="nt-chip"
                      onClick={() => setForm({
                        id: speaker.id, name: speaker.name, role: speaker.role, organization: speaker.organization,
                        track: speaker.track, bio: speaker.bio, socialUrl: speaker.socialUrl ?? "",
                      })}
                    >
                      Edit
                    </button>{" "}
                    <button type="button" className="nt-chip" onClick={() => setPending(speaker)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="nt-empty">{query ? "No speakers match that search." : "No speakers yet. Add the first one above."}</div>
      )}
      {pending ? (
        <ConfirmDelete
          label={pending.name}
          onCancel={() => setPending(null)}
          onOk={() => { void deleteSpeaker(pending.id); setPending(null); }}
        />
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------- venues

const EMPTY_VENUE = { name: "", address: "", city: "", region: "", country: "Tanzania" };

export function AdminVenuesPage() {
  const { db, saveVenue, live, syncing } = usePlatform();
  const [form, setForm] = useState<typeof EMPTY_VENUE & { id?: string }>(EMPTY_VENUE);
  const venues = db.venues.filter((item) => item.id !== TBA_VENUE_ID).sort((a, b) => a.name.localeCompare(b.name));
  const eventCount = (id: string) => db.events.filter((item) => item.venueId === id).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return;
    if (await saveVenue(form)) setForm(EMPTY_VENUE);
  }

  const edit = (venue: Venue) =>
    setForm({ id: venue.id, name: venue.name, address: venue.address, city: venue.city, region: venue.region, country: venue.country });

  return (
    <div>
      <h1>Venues</h1>
      <p className="nt-lede">Places events can be held. Pick a venue on the event form{live ? "; changes are saved to the server." : "."}</p>
      <form className="nt-card" style={{ marginBottom: 16, maxWidth: 760 }} onSubmit={submit}>
        <h3>{form.id ? "Edit venue" : "Add venue"}</h3>
        <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {(
            [
              ["name", "Venue name", true],
              ["address", "Street address", false],
              ["city", "City", false],
              ["region", "Region", false],
              ["country", "Country", false],
            ] as const
          ).map(([key, label, required]) => (
            <label key={key} className="nt-field">
              <span>{label}</span>
              <input value={form[key]} required={required} maxLength={key === "address" ? 300 : 200} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="nt-actions">
          <button type="submit" className="nt-btn" disabled={syncing}>{form.id ? "Save changes" : "Add venue"}</button>
          {form.id ? <button type="button" className="nt-btn ghost" onClick={() => setForm(EMPTY_VENUE)}>Cancel</button> : null}
        </div>
      </form>
      <div className="nt-table-wrap">
        <table className="nt-table">
          <thead>
            <tr><th>Venue</th><th>City</th><th>Country</th><th>Events</th><th><span className="nt-sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {venues.map((venue) => (
              <tr key={venue.id}>
                <td><strong>{venue.name}</strong><div className="nt-muted">{venue.address}</div></td>
                <td>{venue.city || "—"}</td>
                <td>{venue.country || "—"}</td>
                <td>{eventCount(venue.id)}</td>
                <td><button type="button" className="nt-chip" onClick={() => edit(venue)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- team

const ORG_ROLES: Array<{ value: api.OrganizationRole; label: string; hint: string }> = [
  { value: "owner", label: "Owner", hint: "Everything, including granting owner" },
  { value: "admin", label: "Admin", hint: "Manage events, team and finance" },
  { value: "finance", label: "Finance", hint: "Payments and revenue for every event" },
  { value: "member", label: "Member", hint: "View events in the console" },
];

const STAFF_ROLES: Array<{ value: api.EventStaffRole; label: string }> = [
  { value: "manager", label: "Event manager" },
  { value: "staff", label: "Staff" },
  { value: "check_in", label: "Check-in only" },
  { value: "speaker", label: "Speaker" },
];

const roleLabel = (value: string) =>
  ORG_ROLES.find((item) => item.value === value)?.label ?? STAFF_ROLES.find((item) => item.value === value)?.label ?? value;

export function AdminTeamPage() {
  const { db, live, organizationId, user, access } = usePlatform();
  const [team, setTeam] = useState<api.OrganizationTeamDto | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<api.OrganizationRole>("admin");
  const managedEvents = db.events.filter((item) => access[item.id]?.can_manage_event);
  const [staffEventId, setStaffEventId] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<api.EventStaffRole>("check_in");
  const eventId = staffEventId || managedEvents[0]?.id || "";

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setTeam(await api.fetchTeam(organizationId));
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof ApiError && err.status === 403 ? "Only organization owners and admins can manage the team." : String((err as Error).message) });
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      await load();
      setStatus({ tone: "ok", text: success });
      return true;
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Something went wrong." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!live) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1>Team</h1>
        <div className="nt-empty">
          <strong>Team roles live on the server.</strong>
          <p className="nt-muted">Connect the frontend to the API (set VITE_API_BASE_URL) and sign in as an organization owner or admin to invite colleagues and assign event staff.</p>
        </div>
      </div>
    );
  }
  if (!organizationId) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1>Team</h1>
        <div className="nt-empty">Your account manages individual events but not an organization, so you can’t change the team here.</div>
      </div>
    );
  }

  const eventTitle = (id: string) => db.events.find((item) => item.id === id)?.title ?? "Event";

  return (
    <div style={{ maxWidth: 900 }}>
      <h1>Team</h1>
      <p className="nt-lede">Give colleagues access to the organiser console. They need a Neurotech Events account first; add them by the email they signed up with.</p>
      {status ? (
        <div role={status.tone === "error" ? "alert" : "status"} className="nt-card" style={{ marginBottom: 16, borderColor: status.tone === "error" ? "#c0392b" : "#2f7d34" }}>
          {status.text}
        </div>
      ) : null}

      <form
        className="nt-card"
        style={{ marginBottom: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api.addTeamMember(organizationId, email.trim(), role), `${email.trim()} now has the ${roleLabel(role)} role.`)) setEmail("");
        }}
      >
        <h3>Organization members</h3>
        <div className="nt-grid" style={{ gridTemplateColumns: "2fr 1fr auto", alignItems: "end" }}>
          <label className="nt-field">
            <span>Email</span>
            <input type="email" required value={email} autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as api.OrganizationRole)}>
              {ORG_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="submit" className="nt-btn" disabled={busy} style={{ marginBottom: 14 }}>Add or update</button>
        </div>
        <p className="nt-muted" style={{ marginTop: 0 }}>{ORG_ROLES.find((item) => item.value === role)?.hint}</p>
        <div className="nt-table-wrap">
          <table className="nt-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th><span className="nt-sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(team?.members ?? []).map((member) => (
                <tr key={member.user_id}>
                  <td>{member.full_name}{member.user_id === user?.id ? " (you)" : ""}</td>
                  <td>{member.email}</td>
                  <td>{roleLabel(member.role)}</td>
                  <td>
                    {member.user_id === user?.id ? null : (
                      <button type="button" className="nt-chip" disabled={busy} onClick={() => run(() => api.removeTeamMember(organizationId, member.user_id), `${member.email} was removed.`)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {team && !team.members.length ? <tr><td colSpan={4} className="nt-muted">No members yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </form>

      <form
        className="nt-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!eventId) return;
          if (await run(() => api.addEventStaff(eventId, staffEmail.trim(), staffRole), `${staffEmail.trim()} was assigned to ${eventTitle(eventId)}.`)) setStaffEmail("");
        }}
      >
        <h3>Event staff</h3>
        <p className="nt-muted" style={{ marginTop: 0 }}>Scope access to a single event, for example door staff who only need check-in.</p>
        <div className="nt-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", alignItems: "end" }}>
          <label className="nt-field">
            <span>Event</span>
            <select value={eventId} onChange={(e) => setStaffEventId(e.target.value)}>
              {managedEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="nt-field">
            <span>Email</span>
            <input type="email" required value={staffEmail} autoComplete="off" onChange={(e) => setStaffEmail(e.target.value)} />
          </label>
          <label className="nt-field">
            <span>Role</span>
            <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as api.EventStaffRole)}>
              {STAFF_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="submit" className="nt-btn" disabled={busy || !eventId} style={{ marginBottom: 14 }}>Assign</button>
        </div>
        <div className="nt-table-wrap">
          <table className="nt-table">
            <thead><tr><th>Name</th><th>Event</th><th>Role</th><th><span className="nt-sr-only">Actions</span></th></tr></thead>
            <tbody>
              {(team?.event_staff ?? []).map((staff) => (
                <tr key={`${staff.event_id}-${staff.user_id}`}>
                  <td>{staff.full_name}<div className="nt-muted">{staff.email}</div></td>
                  <td>{eventTitle(staff.event_id)}</td>
                  <td>{roleLabel(staff.role)}</td>
                  <td>
                    <button type="button" className="nt-chip" disabled={busy} onClick={() => run(() => api.removeEventStaff(staff.event_id, staff.user_id), `${staff.email} was removed from ${eventTitle(staff.event_id)}.`)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {team && !team.event_staff.length ? <tr><td colSpan={4} className="nt-muted">No event-level staff yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
