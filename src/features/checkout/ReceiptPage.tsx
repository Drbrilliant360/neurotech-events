import { useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, StatusPill } from "../../components/shared/Widgets";
import { formatDateTime } from "../../lib/dates";
import { formatMoney, paymentMethodLabel } from "../../lib/money";
import { registrationBundle } from "../../repositories/platform";

export function ReceiptPage() {
  const { registrationId = "" } = useParams();
  const { db } = usePlatform();
  const bundle = registrationBundle(db, registrationId);
  if (!bundle?.payment) {
    return (
      <div className="nt-container" style={{ padding: 48 }}>
        <EmptyState title="Receipt not found" body="Complete checkout to generate a receipt." />
      </div>
    );
  }
  const { attendee, event, ticket, payment, registration } = bundle;

  return (
    <div className="nt-container nt-page" style={{ maxWidth: 760, padding: "44px 24px 90px" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
        <h1>Receipt</h1>
        <button type="button" className="nt-btn" onClick={() => window.print()}>
          Print / download
        </button>
      </div>
      <article className="nt-card" style={{ padding: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div className="nt-brand">
            <span className="nt-mark sm" />
            <div>
              <strong>NeuroTech Summit</strong>
              <div className="nt-muted">Demo invoice · not a fiscal receipt</div>
            </div>
          </div>
          <div>
            <div className="nt-kicker">Tax invoice</div>
            <div>{registration.ticketNumber}</div>
            <div className="nt-muted">{formatDateTime(payment.updatedAt)}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20, padding: "24px 0" }}>
          <div>
            <div className="nt-kicker">Billed to</div>
            {attendee.fullName}
            <br />
            {attendee.organization}
            <br />
            {attendee.email}
            <br />
            {attendee.phone}
          </div>
          <div>
            <div className="nt-kicker">Payment</div>
            {paymentMethodLabel(payment.method)}
            <br />
            {payment.reference}
            <br />
            <StatusPill value={payment.status} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid rgba(18,21,12,.08)" }}>
          <span>
            {ticket.name} · {event.title}
          </span>
          <span>{formatMoney(ticket.price)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
          <span>VAT {db.settings.vatPercent}%</span>
          <span>{formatMoney(payment.amount - ticket.price)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 18, font: "700 26px Manrope,sans-serif" }}>
          <span>Total</span>
          <span>{formatMoney(payment.amount)}</span>
        </div>
      </article>
    </div>
  );
}
