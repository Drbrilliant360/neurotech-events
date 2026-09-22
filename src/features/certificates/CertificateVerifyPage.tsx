import { Link, useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { formatDate } from "../../lib/dates";

/** Public verification of a certificate code, e.g. /verify/CERT-NT-0001. */
export function CertificateVerifyPage() {
  const { certificateId = "" } = useParams();
  const { db } = usePlatform();
  const code = certificateId.trim().toUpperCase();
  const certificate = db.certificates.find((item) => item.certificateId.toUpperCase() === code);
  const attendee = certificate ? db.attendees.find((item) => item.id === certificate.attendeeId) : undefined;
  const event = certificate ? db.events.find((item) => item.id === certificate.eventId) : undefined;

  return (
    <div className="nt-container nt-page nt-form-page" style={{ maxWidth: 720 }}>
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">Certificate verification</p>
          <h1>{certificate ? "Valid certificate" : "Certificate not found"}</h1>
          <p className="nt-lede">
            {certificate
              ? "This certificate code matches an attendance record issued by Neurotech Events."
              : "No certificate with this code exists in our records. Check the code printed on the certificate and try again."}
          </p>
        </div>
      </div>
      <article className="nt-card nt-form-card" aria-live="polite">
        <div className="nt-profile-details">
          <div className="nt-profile-detail"><span>Code</span><strong>{code || "—"}</strong></div>
          <div className="nt-profile-detail"><span>Status</span><strong>{certificate ? "Verified" : "Not recognised"}</strong></div>
          {certificate ? (
            <>
              <div className="nt-profile-detail"><span>Issued to</span><strong>{attendee?.fullName ?? "—"}</strong></div>
              <div className="nt-profile-detail"><span>Event</span><strong>{event?.title ?? "—"}</strong></div>
              <div className="nt-profile-detail"><span>Issued on</span><strong>{formatDate(certificate.issuedAt)}</strong></div>
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
