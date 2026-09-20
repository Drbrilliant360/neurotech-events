import { useMemo, useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { MediaTile } from "../../components/shared/Widgets";
import { speakerImageById } from "../../lib/media";

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
    <div className="nt-container nt-page nt-directory-page">
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">People shaping the programme</p>
          <h1>Meet the speakers behind the conversations.</h1>
          <p className="nt-lede">Researchers, clinicians, founders and technology leaders sharing practical insight across Neurotech Africa events.</p>
        </div>
        <div className="nt-page-intro-stat">
          <strong>{list.length}</strong>
          <span>{track === "All tracks" ? "speakers" : `${track} speakers`}</span>
        </div>
      </div>

      <div className="nt-speaker-filter" aria-label="Filter speakers by track">
        {tracks.map((item) => (
          <button key={item} type="button" className={`nt-chip ${item === track ? "is-on" : ""}`} onClick={() => setTrack(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="nt-grid nt-speaker-grid">
        {list.map((speaker) => (
          <article key={speaker.id} className="nt-card nt-speaker-card">
            <MediaTile label={speaker.name} height={200} src={speakerImageById(speaker.id)} />
            <h3>{speaker.name}</h3>
            <div className="nt-speaker-role">{speaker.role}</div>
            <div className="nt-muted">{speaker.organization}</div>
            <div className="nt-event-card-footer">
              <span className="nt-badge neutral">{speaker.track}</span>
              <button type="button" className="nt-arrow-link" style={{ border: 0, background: "transparent", padding: 0 }} onClick={() => setOpenId(speaker.id)}>
                View profile →
              </button>
            </div>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="nt-dialog" role="dialog" aria-modal="true" aria-labelledby="speaker-title" onClick={() => setOpenId(null)}>
          <div className="nt-dialog-card" onClick={(e) => e.stopPropagation()}>
            <p className="nt-kicker">Speaker profile</p>
            <h2 id="speaker-title">{selected.name}</h2>
            <p className="nt-speaker-role">{selected.role}</p>
            <p className="nt-muted">{selected.organization}</p>
            <p>{selected.bio}</p>
            {selected.socialUrl ? <p><a href={selected.socialUrl} rel="noreferrer">Professional profile →</a></p> : null}
            <p className="nt-kicker" style={{ marginTop: 28 }}>Related sessions</p>
            {related.length === 0 ? <p className="nt-muted">No sessions assigned yet.</p> : related.map((session) => (
              <div key={session.id} className="nt-card" style={{ marginBottom: 8 }}>
                <strong>{session.title}</strong>
                <div className="nt-muted">{session.dayLabel} · {session.startTime} · {session.room}</div>
              </div>
            ))}
            <button type="button" className="nt-btn" onClick={() => setOpenId(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
