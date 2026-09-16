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
    return (
      <div className="nt-container" style={{ padding: 48 }}>
        <EmptyState title="Payment not found" body="Return to checkout from your registration." />
      </div>
    );
  }

  const current = payment;

  function demo(outcome: "paid" | "failed" | "cancelled") {
    pay(current.id, current.method, outcome);
  }

  return (
    <div className="nt-container nt-page" style={{ maxWidth: 640, padding: "44px 24px 90px" }}>
      <div className="no-print" style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 26 }}>
        <button type="button" className="nt-chip" onClick={() => demo("paid")}>
          Simulate success
        </button>
        <button type="button" className="nt-chip" onClick={() => demo("failed")}>
          Simulate failure
        </button>
        <button type="button" className="nt-chip" onClick={() => demo("cancelled")}>
          Cancel payment
        </button>
      </div>
      <div className="nt-card" style={{ textAlign: "center", padding: 40 }}>
        <StatusPill value={phase} />
        <h1 style={{ marginTop: 16 }}>{phase === "paid" ? "Payment received" : phase === "failed" ? "Payment not completed" : phase === "cancelled" ? "Payment cancelled" : "Waiting for approval"}</h1>
        <p className="nt-lede" style={{ marginInline: "auto" }}>
          {formatMoney(payment.amount)} · {paymentMethodLabel(payment.method)}
          <br />
          Reference {payment.reference}
          <br />
          {bundle.attendee.fullName} · {bundle.event.title}
        </p>
        {phase === "paid" ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/app/ticket" className="nt-btn">
              View ticket
            </Link>
            <Link to={`/receipt/${bundle.registration.id}`} className="nt-btn ghost">
              View receipt
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="nt-btn" onClick={() => demo("paid")}>
              Retry payment
            </button>
            <Link to={`/checkout/${bundle.registration.id}`} className="nt-btn ghost">
              Change method
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
