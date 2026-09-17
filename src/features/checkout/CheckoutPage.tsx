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
    return <div className="nt-container" style={{ padding: 48 }}><EmptyState title="Checkout not found" body="Start registration again from the event page." /></div>;
  }

  const { registration, attendee, event, ticket, payment } = bundle;

  function startPay() {
    if (!accepted || busy) return;
    setBusy(true);
    if (payment.status !== "paid" && ticket.price > 0) pay(payment.id, method, "paid");
    navigate(`/payment/${payment.id}`);
  }

  return (
    <div className="nt-container nt-page nt-form-page" style={{ maxWidth: 1080 }}>
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">Secure checkout · Demo environment</p>
          <h1>Complete your registration.</h1>
          <p className="nt-lede">{registration.ticketNumber} · {event.title}</p>
        </div>
      </div>

      <div className="nt-form-shell">
        <div className="nt-grid">
          <section className="nt-card nt-form-card">
            <div className="nt-panel-header">
              <div><p className="nt-kicker">Attendee</p><h3>{attendee.fullName}</h3></div>
              <span className="nt-badge ok">Registration ready</span>
            </div>
            <div className="nt-profile-details">
              <div className="nt-profile-detail"><span>Email</span><strong>{attendee.email}</strong></div>
              <div className="nt-profile-detail"><span>Phone</span><strong>{attendee.phone}</strong></div>
              <div className="nt-profile-detail"><span>Organization</span><strong>{attendee.organization}</strong></div>
              <div className="nt-profile-detail"><span>Ticket</span><strong>{ticket.name}</strong></div>
            </div>
          </section>

          <section className="nt-card nt-form-card">
            <p className="nt-kicker">Payment method</p>
            <h2>How would you like to pay?</h2>
            <p className="nt-muted">This frontend simulates the payment experience. Do not enter real payment credentials.</p>
            <div className="nt-grid cards" style={{ marginTop: 20 }}>
              {METHODS.map((item) => (
                <button key={item} type="button" className={`nt-choice ${method === item ? "is-on" : ""}`} onClick={() => setMethod(item)}>
                  <strong>{paymentMethodLabel(item)}</strong>
                  <div className="nt-muted">{isMobileMoney(item) ? "Mobile money prompt" : item === "card" ? "Card checkout" : "Bank payment"}</div>
                </button>
              ))}
            </div>
            {isMobileMoney(method) ? <div className="nt-checkout-note">A {paymentMethodLabel(method)} prompt will be simulated for {attendee.phone}. No PIN is collected in this demo.</div> : null}
          </section>

          <label className="nt-consent-row">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>I accept the event terms and understand that this local demo does not charge a real wallet, card or bank account.</span>
          </label>
        </div>

        <aside className="nt-flow-summary nt-order-summary">
          <p className="nt-kicker">Order summary</p>
          <h3>{event.title}</h3>
          <dl>
            <div><dt>{ticket.name} pass × 1</dt><dd>{formatMoney(ticket.price)}</dd></div>
            <div><dt>VAT {db.settings.vatPercent}%</dt><dd>{formatMoney(payment.amount - ticket.price)}</dd></div>
            <div className="nt-summary-total"><dt>Total</dt><dd>{formatMoney(payment.amount)}</dd></div>
          </dl>
          <button type="button" className="nt-btn" style={{ width: "100%", marginTop: 18 }} disabled={!accepted || busy} onClick={startPay}>
            {busy ? "Starting…" : `Pay ${formatMoney(payment.amount)}`}
          </button>
          <Link to={`/register/${event.id}`} className="nt-btn ghost" style={{ width: "100%", marginTop: 9 }}>Back to registration</Link>
          <p className="nt-payment-disclaimer">Frontend simulation only · no real payment is processed.</p>
        </aside>
      </div>
    </div>
  );
}
