import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Breadcrumbs } from "../../components/shared/Breadcrumbs";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState } from "../../components/shared/Widgets";
import { formatMoney, isMobileMoney, paymentMethodLabel } from "../../lib/money";
import { registrationBundle } from "../../repositories/platform";
import { fetchTicketQuote, isLivePaymentsEnabled, PaymentApiError, startMobilePayment, type MobileMethod, type TicketQuote } from "../../services/payments";
import { registerFree } from "../../services/platformApi";
import type { PaymentMethod } from "../../domain/types";

const LIVE = isLivePaymentsEnabled();
// Snippe collects mobile money only; card and bank stay available in the local demo.
const METHODS: PaymentMethod[] = LIVE ? ["mpesa", "airtel", "mixx", "halopesa"] : ["mpesa", "airtel", "mixx", "halopesa", "card", "bank"];
type DemoOutcome = "paid" | "failed" | "cancelled";

const OUTCOMES: Array<{ value: DemoOutcome; title: string; body: string }> = [
  { value: "paid", title: "Approve payment", body: "Confirm the ticket and open the receipt." },
  { value: "failed", title: "Simulate a failure", body: "Show the retry and method-change path." },
  { value: "cancelled", title: "Cancel the payment", body: "Release the reservation and return to checkout later." },
];

export function CheckoutPage() {
  const { registrationId = "" } = useParams();
  const { db, pay, linkRemote, discardDraft, reload, user } = usePlatform();
  const navigate = useNavigate();
  const bundle = registrationBundle(db, registrationId);
  const [method, setMethod] = useState<PaymentMethod>(bundle?.payment?.method ?? "mpesa");
  const [phone, setPhone] = useState(bundle?.attendee.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(true);
  const [outcome, setOutcome] = useState<DemoOutcome>("paid");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<TicketQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [freeConfirmed, setFreeConfirmed] = useState<{ ticketNumber: string; eventTitle: string; eventSlug: string; email: string } | null>(null);
  const quoteSlug = bundle?.event.slug;
  const quoteCode = bundle?.ticket.code ?? bundle?.ticket.id;
  const quoteNeeded = LIVE && Boolean(bundle?.payment) && (bundle?.ticket.price ?? 0) > 0 && bundle?.payment?.status !== "paid";

  useEffect(() => {
    if (!quoteNeeded || !quoteSlug || !quoteCode) return;
    let cancelled = false;
    fetchTicketQuote(quoteSlug, quoteCode)
      .then((result) => {
        if (!cancelled) {
          setQuote(result);
          setQuoteError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(
          err instanceof PaymentApiError ? err.message : "Could not verify the price with the payments server.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [quoteNeeded, quoteSlug, quoteCode]);

  if (freeConfirmed) {
    return (
      <div className="nt-container nt-page nt-form-page" style={{ maxWidth: 720 }}>
        <article className="nt-card nt-payment-state-card">
          <div className="nt-payment-state-icon paid" aria-hidden="true">✓</div>
          <h1>You’re registered</h1>
          <p className="nt-lede">Ticket {freeConfirmed.ticketNumber} for {freeConfirmed.eventTitle} is confirmed. Create an account or sign in with {freeConfirmed.email} to see it under My tickets.</p>
          <div className="nt-payment-actions">
            <Link to="/register" className="nt-btn">Create an account</Link>
            <Link to={`/events/${freeConfirmed.eventSlug}`} className="nt-btn ghost">Back to event</Link>
          </div>
        </article>
      </div>
    );
  }

  if (!bundle?.payment) {
    return <div className="nt-container" style={{ padding: 48 }}><EmptyState title="Checkout not found" body="Start registration again from the event page." /></div>;
  }

  const { registration, attendee, event, ticket, payment } = bundle;
  const isFree = ticket.price === 0;
  const quoteBlocks = LIVE && !isFree && (quoteError !== null || (quote !== null && !quote.payable_online));
  const chargeAmount = quote?.total ?? payment.amount;

  async function confirmFree() {
    setBusy(true);
    try {
      const result = await registerFree({
        event_slug: event.slug,
        ticket_code: ticket.code ?? ticket.id,
        phone_number: attendee.phone || undefined,
        attendee: {
          full_name: attendee.fullName,
          email: attendee.email,
          organization: attendee.organization || undefined,
          job_title: attendee.jobTitle || undefined,
          country: attendee.country || undefined,
        },
      });
      discardDraft(registration.id);
      if (user) {
        await reload();
        navigate(`/app/ticket?registration=${result.id}`);
      } else {
        setFreeConfirmed({ ticketNumber: result.ticket_number, eventTitle: event.title, eventSlug: event.slug, email: attendee.email });
      }
    } catch (err) {
      setError(err instanceof PaymentApiError ? err.message : "Could not confirm your registration.");
    } finally {
      setBusy(false);
    }
  }

  async function startPay() {
    if (!accepted || busy) return;
    setError(null);
    if (LIVE && isFree) {
      await confirmFree();
      return;
    }
    if (payment.status === "paid" || isFree) {
      navigate(`/payment/${payment.id}`);
      return;
    }
    if (!LIVE) {
      setBusy(true);
      pay(payment.id, method, outcome);
      navigate(`/payment/${payment.id}`);
      return;
    }
    if (!isMobileMoney(method)) {
      setError("Only mobile money is available for live payments right now.");
      return;
    }
    if (quoteBlocks) {
      setError(quoteError ?? "This ticket cannot be paid online right now.");
      return;
    }
    setBusy(true);
    try {
      const remote = await startMobilePayment({
        event_slug: event.slug,
        ticket_code: ticket.code ?? ticket.id,
        phone_number: phone,
        method: method as MobileMethod,
        attendee: {
          full_name: attendee.fullName,
          email: attendee.email,
          organization: attendee.organization || undefined,
          job_title: attendee.jobTitle || undefined,
          country: attendee.country || undefined,
        },
        client_reference: registration.id,
      });
      linkRemote(payment.id, {
        providerPaymentId: remote.id,
        reference: remote.reference,
        providerReference: remote.provider_reference ?? undefined,
        method: remote.method,
        status: remote.status,
        amount: remote.amount,
      });
      // The server now owns this registration; the browser draft is no longer needed.
      discardDraft(registration.id);
      navigate(`/payment/${remote.id}`);
    } catch (err) {
      setError(err instanceof PaymentApiError ? err.message : "Could not start the payment. Please try again.");
      setBusy(false);
    }
  }

  const payLabel = isFree
    ? "Confirm free registration"
    : LIVE
      ? `Pay ${formatMoney(chargeAmount)}`
      : outcome === "paid"
        ? `Pay ${formatMoney(payment.amount)}`
        : outcome === "failed"
          ? "Simulate payment failure"
          : "Cancel payment";

  return (
    <div className="nt-container nt-page nt-form-page" style={{ maxWidth: 1080 }}>
      <Breadcrumbs items={[{ label: "Events", to: "/events" }, { label: event.title, to: `/events/${event.slug}` }, { label: "Checkout" }]} />
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">{LIVE ? "Secure checkout · Mobile money via Snippe" : "Secure checkout · Demo environment"}</p>
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
            <p className="nt-muted">
              {LIVE
                ? "You will receive a prompt on your phone to approve the payment with your mobile money PIN. We never see your PIN."
                : "This frontend simulates the payment experience. Do not enter real payment credentials."}
            </p>
            <div className="nt-grid cards" style={{ marginTop: 20 }}>
              {METHODS.map((item) => (
                <button key={item} type="button" className={`nt-choice ${method === item ? "is-on" : ""}`} onClick={() => setMethod(item)}>
                  <strong>{paymentMethodLabel(item)}</strong>
                  <div className="nt-muted">{isMobileMoney(item) ? "Mobile money prompt" : item === "card" ? "Card checkout" : "Bank payment"}</div>
                </button>
              ))}
            </div>
            {LIVE && !isFree ? (
              <label className="nt-field" style={{ marginTop: 20, display: "block" }}>
                <span>Mobile money number</span>
                <input
                  className="nt-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  placeholder="0712 345 678 or 255712345678"
                  onChange={(e) => setPhone(e.target.value)}
                  aria-describedby="checkout-phone-help"
                />
                <small id="checkout-phone-help" className="nt-muted">The {paymentMethodLabel(method)} prompt will be sent to this Tanzanian number.</small>
              </label>
            ) : null}
            {!LIVE && isMobileMoney(method) ? <div className="nt-checkout-note">A {paymentMethodLabel(method)} prompt will be simulated for {attendee.phone}. No PIN is collected in this demo.</div> : null}
          </section>

          {!LIVE && !isFree ? (
            <section className="nt-card nt-form-card nt-demo-payment-scenario">
              <div>
                <p className="nt-kicker">Demo payment result</p>
                <h2>Choose what happens next.</h2>
                <p className="nt-muted">This lets you test every payment state without charging a real account.</p>
              </div>
              <div className="nt-demo-outcomes" role="group" aria-label="Demo payment outcome">
                {OUTCOMES.map((item) => (
                  <button key={item.value} type="button" className={`nt-demo-outcome ${outcome === item.value ? "is-on" : ""}`} onClick={() => setOutcome(item.value)}>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <label className="nt-consent-row">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              {LIVE
                ? "I accept the event terms and authorise a mobile money charge for the total shown."
                : "I accept the event terms and understand that this local demo does not charge a real wallet, card or bank account."}
            </span>
          </label>
        </div>

        <aside className="nt-flow-summary nt-order-summary">
          <p className="nt-kicker">Order summary</p>
          <h3>{event.title}</h3>
          <dl>
            <div><dt>{ticket.name} pass × 1</dt><dd>{formatMoney(ticket.price)}</dd></div>
            <div><dt>VAT {db.settings.vatPercent}%</dt><dd>{formatMoney(payment.amount - ticket.price)}</dd></div>
            <div className="nt-summary-total"><dt>Total</dt><dd>{formatMoney(payment.amount)}</dd></div>
            {LIVE && !isFree && quote ? (
              <div><dt>Server-verified charge</dt><dd>{formatMoney(quote.total, quote.currency)}</dd></div>
            ) : null}
          </dl>
          {LIVE && !isFree && quote && quote.total !== payment.amount ? (
            <p className="nt-muted" role="status">The payments server will charge {formatMoney(quote.total, quote.currency)}. Prices are set on the server and may differ from this browser's cached catalogue.</p>
          ) : null}
          {LIVE && !isFree && quote && !quote.payable_online ? (
            <p className="nt-auth-error" role="alert">{quote.available === 0 ? "This ticket type is sold out." : !quote.active ? "This ticket type is not on sale." : "This ticket cannot be paid online."}</p>
          ) : null}
          {LIVE && !isFree && quoteError ? <p className="nt-auth-error" role="alert">{quoteError}</p> : null}
          {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
          <button type="button" className="nt-btn" style={{ width: "100%", marginTop: 18 }} disabled={!accepted || busy || quoteBlocks} onClick={startPay}>
            {busy ? "Sending prompt…" : payLabel}
          </button>
          <Link to={`/events/${event.slug}`} className="nt-btn ghost" style={{ width: "100%", marginTop: 9 }}>Back to event</Link>
          <p className="nt-payment-disclaimer">
            {LIVE ? "Payments are processed by Snippe and confirmed by our server before your ticket is issued." : "Frontend simulation only · no real payment is processed."}
          </p>
        </aside>
      </div>
    </div>
  );
}
