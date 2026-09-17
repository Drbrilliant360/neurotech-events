import { Link, useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, StatusPill } from "../../components/shared/Widgets";
import { formatMoney, paymentMethodLabel } from "../../lib/money";
import { registrationBundle } from "../../repositories/platform";
import type { PaymentStatus } from "../../domain/types";

export function PaymentPage() {
  const { paymentId = "" } = useParams();
  const { db, pay } = usePlatform();
  const payment = db.payments.find((item) => item.id === paymentId);
  const bundle = payment ? registrationBundle(db, payment.registrationId) : undefined;
  const phase: PaymentStatus = payment?.status === "pending" ? "processing" : (payment?.status ?? "processing");

  if (!payment || !bundle) {
    return <div className="nt-container" style={{ padding: 48 }}><EmptyState title="Payment not found" body="Return to checkout from your registration." /></div>;
  }

  const current = payment;
  function demo(outcome: "paid" | "failed" | "cancelled") { pay(current.id, current.method, outcome); }

  const title = phase === "paid" ? "Payment received" : phase === "failed" ? "Payment not completed" : phase === "cancelled" ? "Payment cancelled" : "Waiting for approval";
  const message = phase === "paid"
    ? "Your registration is confirmed. Your ticket and receipt are ready."
    : phase === "failed"
      ? "The simulated payment did not complete. You can retry or choose another method."
      : phase === "cancelled"
        ? "This payment attempt was cancelled. Your registration can still be completed."
        : "Keep this page open while the simulated payment response is processed.";

  return (
    <div className="nt-container nt-page nt-form-page nt-payment-page" style={{ maxWidth: 760 }}>
      <div className="nt-demo-controls no-print">
        <span>Demo controls</span>
        <button type="button" className="nt-chip" onClick={() => demo("paid")}>Success</button>
        <button type="button" className="nt-chip" onClick={() => demo("failed")}>Failure</button>
        <button type="button" className="nt-chip" onClick={() => demo("cancelled")}>Cancel</button>
      </div>

      <article className="nt-card nt-payment-state-card">
        <div className={`nt-payment-state-icon ${phase}`} aria-hidden="true">
          {phase === "paid" ? "✓" : phase === "failed" ? "!" : phase === "cancelled" ? "×" : "…"}
        </div>
        <StatusPill value={phase} />
        <h1>{title}</h1>
        <p className="nt-lede">{message}</p>

        <div className="nt-payment-facts">
          <div><span>Amount</span><strong>{formatMoney(payment.amount)}</strong></div>
          <div><span>Method</span><strong>{paymentMethodLabel(payment.method)}</strong></div>
          <div><span>Reference</span><strong>{payment.reference}</strong></div>
          <div><span>Attendee</span><strong>{bundle.attendee.fullName}</strong></div>
        </div>

        <div className="nt-payment-actions">
          {phase === "paid" ? (
            <>
              <Link to="/app/ticket" className="nt-btn">View ticket</Link>
              <Link to={`/receipt/${bundle.registration.id}`} className="nt-btn ghost">View receipt</Link>
            </>
          ) : (
            <>
              <button type="button" className="nt-btn" onClick={() => demo("paid")}>Retry payment</button>
              <Link to={`/checkout/${bundle.registration.id}`} className="nt-btn ghost">Change method</Link>
            </>
          )}
        </div>
        <div className="nt-payment-event">{bundle.event.title}</div>
      </article>
    </div>
  );
}
