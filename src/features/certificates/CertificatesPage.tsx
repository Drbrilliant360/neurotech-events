import { useState } from "react";
import { Link } from "react-router-dom";
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
    <div>
      <div className="nt-dashboard-head">
        <div>
          <p className="nt-kicker">Achievements</p>
          <h1>My certificates</h1>
          <p className="nt-lede">Access attendance credentials from completed Neurotech events and keep a record of your participation.</p>
        </div>
        <button type="button" className="nt-btn ghost no-print" onClick={issueCerts}>Refresh eligibility</button>
      </div>

      {mine.length === 0 ? (
        <EmptyState title="No certificates yet" body="Certificates appear for completed events after check-in." />
      ) : (
        <div className="nt-grid cards">
          {mine.map((cert) => {
            const event = db.events.find((item) => item.id === cert.eventId);
            return (
              <article key={cert.id} className="nt-card">
                <div className="nt-media" style={{ minHeight: 145, marginBottom: 18, background: "linear-gradient(145deg,#101710,#253822)", color: "#fff" }}>
                  <div>
                    <div className="nt-kicker" style={{ color: "#afbea9" }}>Certificate of attendance</div>
                    <strong style={{ font: "700 20px Manrope,sans-serif" }}>Neurotech Africa</strong>
                  </div>
                </div>
                <h3>{event?.title}</h3>
                <div className="nt-muted" style={{ marginBottom: 18 }}>{event ? formatDate(event.startsAt) : ""} · {cert.certificateId}</div>
                <button type="button" className="nt-btn" style={{ width: "100%" }} onClick={() => setOpenId(cert.id)}>View certificate</button>
              </article>
            );
          })}
        </div>
      )}

      {open && attendee ? (
        <div className="nt-dialog" role="dialog" aria-modal="true" onClick={() => setOpenId(null)}>
          <div className="nt-dialog-card" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="nt-cert">
              <div className="nt-kicker">NeuroTech Events</div>
              <h2>Certificate of Attendance</h2>
              <p>This certifies that</p>
              <h3 style={{ fontSize: 30 }}>{attendee.fullName}</h3>
              <p>participated in {db.events.find((item) => item.id === open.eventId)?.title}</p>
              <p>{formatDate(open.issuedAt)} · {open.certificateId}</p>
            </div>
            <p className="no-print nt-muted" style={{ marginTop: 12 }}>
              Anyone can verify this certificate at <Link to={`/verify/${open.certificateId}`}>/verify/{open.certificateId}</Link>.
            </p>
            <div className="no-print nt-actions" style={{ marginTop: 16 }}>
              <button type="button" className="nt-btn" onClick={() => window.print()}>Print / save as PDF</button>
              <button type="button" className="nt-btn ghost" onClick={() => setOpenId(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
