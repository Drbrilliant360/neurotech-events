import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { formatDate } from "../../lib/dates";
import { ApiError } from "../../services/api";
import { verifyCertificate } from "../../services/platformApi";

interface Verified { attendeeName: string; eventTitle: string; issuedAt: string }

/** Public verification of a certificate code, e.g. /verify/NT-3F9A1C2B7D0E. */
export function CertificateVerifyPage() {
  const { certificateId = "" } = useParams();
  const { db, live } = usePlatform();
  const code = certificateId.trim().toUpperCase();
  const [remote, setRemote] = useState<{ code: string; result: Verified | null; error?: string } | null>(null);

  useEffect(() => {
    if (!live || !code) return;
    let active = true;
    verifyCertificate(code)
      .then((dto) => active && setRemote({ code, result: { attendeeName: dto.attendee_name, eventTitle: dto.event_title, issuedAt: dto.issued_at } }))
      .catch((err) => active && setRemote({
        code, result: null,
        error: err instanceof ApiError && err.status === 404 ? undefined : "We couldn’t reach the verification service. Try again shortly.",
      }));
    return () => { active = false; };
  }, [live, code]);

  let verified: Verified | null = null;
  if (!live) {
    const certificate = db.certificates.find((item) => item.certificateId.toUpperCase() === code);
    if (certificate) {
      verified = {
        attendeeName: db.attendees.find((item) => item.id === certificate.attendeeId)?.fullName ?? "—",
        eventTitle: db.events.find((item) => item.id === certificate.eventId)?.title ?? "—",
        issuedAt: certificate.issuedAt,
      };
    }
  } else if (remote?.code === code) {
    verified = remote.result;
  }
  const loading = live && Boolean(code) && remote?.code !== code;
  const error = live && remote?.code === code ? remote.error : undefined;

  return (
    <div className="nt-container nt-page nt-form-page" style={{ maxWidth: 720 }}>
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">Certificate verification</p>
          <h1>{loading ? "Checking certificate…" : verified ? "Valid certificate" : error ? "Verification unavailable" : "Certificate not found"}</h1>
          <p className="nt-lede">
            {loading
              ? "Looking up this code in the Neurotech Events records."
              : verified
                ? "This certificate code matches an attendance record issued by Neurotech Events."
                : error ?? "No certificate with this code exists in our records. Check the code printed on the certificate and try again."}
          </p>
        </div>
      </div>
      <article className="nt-card nt-form-card" aria-live="polite" aria-busy={loading}>
        <div className="nt-profile-details">
          <div className="nt-profile-detail"><span>Code</span><strong>{code || "—"}</strong></div>
          <div className="nt-profile-detail"><span>Status</span><strong>{loading ? "Checking…" : verified ? "Verified" : "Not recognised"}</strong></div>
          {verified ? (
            <>
              <div className="nt-profile-detail"><span>Issued to</span><strong>{verified.attendeeName}</strong></div>
              <div className="nt-profile-detail"><span>Event</span><strong>{verified.eventTitle}</strong></div>
              <div className="nt-profile-detail"><span>Issued on</span><strong>{formatDate(verified.issuedAt)}</strong></div>
            </>
          ) : null}
        </div>
        <p className="nt-muted" style={{ marginTop: 18 }}>
          Certificates are issued only to attendees who checked in at the event. Questions? Email {db.settings.contactEmail}.
        </p>
        <div className="nt-actions" style={{ marginTop: 18 }}>
          <Link to="/events" className="nt-btn ghost">Browse events</Link>
        </div>
      </article>
    </div>
  );
}
