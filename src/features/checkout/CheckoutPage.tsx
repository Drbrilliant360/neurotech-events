import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState } from "../../components/shared/Widgets";
import { formatMoney, isMobileMoney, paymentMethodLabel } from "../../lib/money";
import { registrationBundle } from "../../repositories/platform";
import type { PaymentMethod } from "../../domain/types";

const METHODS: PaymentMethod[] = ["mpesa", "airtel", "mixx", "halopesa", "card", "bank"];

export function CheckoutPage() {
  const { registrationId = "" } = useParams();
  const { db, pay } = usePlatform();
  const navigate = useNavigate();
  const bundle = registrationBundle(db, registrationId);
  const [method, setMethod] = useState<PaymentMethod>(bundle?.payment?.method ?? "mpesa");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(true);

  if (!bundle?.payment) {
    return (
      <div className="nt-container" style={{ padding: 48 }}>
        <EmptyState title="Checkout not found" body="Start registration again from the event page." />
      </div>
    );
  }

  const { registration, attendee, event, ticket, payment } = bundle;

  function startPay() {
    if (!accepted || busy) return;
    setBusy(true);
    if (payment.status !== "paid" && ticket.price > 0) {
      pay(payment.id, method, "paid");
    }
    navigate(`/payment/${payment.id}`);
  }

  return (
    <div className="nt-container nt-page" style={{ padding: "44px 24px 90px" }}>
      <h1>Checkout</h1>
      <p className="nt-lede">
        {registration.ticketNumber} · {event.title}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(240px,360px)", gap: 32 }}>
        <div className="nt-grid">
          <div className="nt-card">
            <h3>Attendee</h3>
            <p>
              {attendee.fullName}
              <br />
              {attendee.email}
              <br />
              {attendee.phone}
              <br />
              {attendee.organization}
            </p>
          </div>
          <div className="nt-card">
            <h3>Payment method</h3>
            <p className="nt-muted">Frontend simulation only. Do not enter real payment credentials.</p>
            <div className="nt-grid cards">
              {METHODS.map((item) => (
                <button key={item} type="button" className={`nt-choice ${method === item ? "is-on" : ""}`} onClick={() => setMethod(item)}>
                  {paymentMethodLabel(item)}
                </button>
              ))}
            </div>
            {isMobileMoney(method) ? (
              <p className="nt-muted" style={{ marginTop: 16 }}>
                A {paymentMethodLabel(method)} prompt will be simulated for {attendee.phone}. No PIN is collected in this demo.
              </p>
            ) : null}
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>I accept the summit terms. This checkout is a local demo and does not charge a real wallet or card.</span>
          </label>
        </div>
        <aside className="nt-card">
          <p className="nt-kicker">Order summary</p>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
            <span>
              {ticket.name} pass × 1
            </span>
            <span>{formatMoney(ticket.price)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
            <span>VAT {db.settings.vatPercent}%</span>
            <span>{formatMoney(payment.amount - ticket.price)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 0", font: "700 22px Manrope,sans-serif" }}>
            <span>Total</span>
            <span>{formatMoney(payment.amount)}</span>
          </div>
          <button type="button" className="nt-btn" style={{ width: "100%" }} disabled={!accepted || busy} onClick={startPay}>
            {busy ? "Starting…" : `Pay ${formatMoney(payment.amount)}`}
          </button>
          <Link to={`/register/${event.id}`} className="nt-btn ghost" style={{ width: "100%", marginTop: 10 }}>
            Back
          </Link>
        </aside>
      </div>
    </div>
  );
}
