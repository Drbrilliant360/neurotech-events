import { useMemo, useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { MediaTile } from "../../components/shared/Widgets";

export function SpeakersPage() {
  const { db } = usePlatform();
  const [track, setTrack] = useState("All tracks");
  const [openId, setOpenId] = useState<string | null>(null);
  const tracks = ["All tracks", ...Array.from(new Set(db.speakers.map((speaker) => speaker.track)))];
  const list = useMemo(
    () => db.speakers.filter((speaker) => track === "All tracks" || speaker.track === track),
    [db.speakers, track],
  );
  const selected = db.speakers.find((speaker) => speaker.id === openId);
  const related = db.sessions.filter((session) => session.speakerId === openId);

  return (
    <div className="nt-container nt-page" style={{ padding: "44px 24px 90px" }}>
      <h1>Speakers</h1>
      <p className="nt-lede">Researchers, clinicians and founders across the NeuroTech programme.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
        {tracks.map((item) => (
          <button key={item} type="button" className={`nt-chip ${item === track ? "is-on" : ""}`} onClick={() => setTrack(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="nt-grid cards">
        {list.map((speaker) => (
          <article key={speaker.id} className="nt-card">
            <MediaTile label={speaker.initials} height={190} />
            <h3 style={{ marginTop: 15 }}>{speaker.name}</h3>
            <div style={{ color: "#2f7d34" }}>{speaker.role}</div>
            <div className="nt-muted">{speaker.organization}</div>
            <button type="button" className="nt-btn ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setOpenId(speaker.id)}>
              View Profile
            </button>
          </article>
        ))}
      </div>
      {selected ? (
        <div className="nt-dialog" role="dialog" aria-modal="true" aria-labelledby="speaker-title" onClick={() => setOpenId(null)}>
          <div className="nt-dialog-card" onClick={(e) => e.stopPropagation()}>
            <h2 id="speaker-title">{selected.name}</h2>
            <p style={{ color: "#2f7d34" }}>{selected.role}</p>
            <p className="nt-muted">{selected.organization}</p>
            <p>{selected.bio}</p>
            {selected.socialUrl ? (
              <p>
                <a href={selected.socialUrl} rel="noreferrer">
                  Professional profile
                </a>
              </p>
            ) : null}
            <p className="nt-kicker">Related sessions</p>
            {related.length === 0 ? <p className="nt-muted">No sessions assigned yet.</p> : related.map((session) => (
              <div key={session.id} className="nt-card" style={{ marginBottom: 8 }}>
                {session.title}
                <div className="nt-muted">
                  {session.dayLabel} · {session.startTime} · {session.room}
                </div>
              </div>
            ))}
            <button type="button" className="nt-btn" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
