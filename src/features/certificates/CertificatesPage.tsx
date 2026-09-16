import { useState } from "react";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState } from "../../components/shared/Widgets";
import { formatDate } from "../../lib/dates";

export function CertificatesPage() {
  const { db, attendeeId, issueCerts } = usePlatform();
  const [openId, setOpenId] = useState<string | null>(null);
  const mine = db.certificates.filter((item) => item.attendeeId === attendeeId);
  const attendee = db.attendees.find((item) => item.id === attendeeId);
  const open = mine.find((item) => item.id === openId);

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>My certificates</h1>
      <button type="button" className="nt-btn ghost no-print" onClick={issueCerts} style={{ marginBottom: 16 }}>
        Refresh eligibility
      </button>
      {mine.length === 0 ? (
        <EmptyState title="No certificates yet" body="Certificates appear for completed events after check-in." />
      ) : (
        mine.map((cert) => {
          const event = db.events.find((item) => item.id === cert.eventId);
          return (
            <div key={cert.id} className="nt-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3>{event?.title}</h3>
                  <div className="nt-muted">
                    {event ? formatDate(event.startsAt) : ""} · {cert.certificateId}
                  </div>
                </div>
                <button type="button" className="nt-btn" onClick={() => setOpenId(cert.id)}>
                  View
                </button>
              </div>
            </div>
          );
        })
      )}
      {open && attendee ? (
        <div className="nt-dialog" role="dialog" aria-modal="true" onClick={() => setOpenId(null)}>
          <div className="nt-dialog-card" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="nt-cert">
              <div className="nt-kicker">NeuroTech Events</div>
              <h2>Certificate of Attendance</h2>
              <p>This certifies that</p>
              <h3 style={{ fontSize: 28 }}>{attendee.fullName}</h3>
              <p>participated in {db.events.find((item) => item.id === open.eventId)?.title}</p>
              <p>
                {formatDate(open.issuedAt)} · {open.certificateId}
              </p>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" className="nt-btn" onClick={() => window.print()}>
                Print / download
              </button>
              <button type="button" className="nt-btn ghost" onClick={() => setOpenId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
