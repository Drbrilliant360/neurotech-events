import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Breadcrumbs } from "../../components/shared/Breadcrumbs";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState, StatusPill } from "../../components/shared/Widgets";
import { formatMoney, paymentMethodLabel } from "../../lib/money";
import { registrationBundle } from "../../repositories/platform";
import { fetchPayment, isLivePaymentsEnabled, PaymentApiError, type RemotePayment } from "../../services/payments";
import { resendPaymentPrompt } from "../../services/platformApi";
import type { PaymentStatus } from "../../domain/types";

const LIVE = isLivePaymentsEnabled();
const POLL_MS = 4000;
const SETTLED: PaymentStatus[] = ["paid", "failed", "cancelled", "refunded"];

function DemoPaymentPage() {
  const { paymentId = "" } = useParams();
  const { db, pay } = usePlatform();
  const payment = db.payments.find((item) => item.id === paymentId);
  const bundle = payment ? registrationBundle(db, payment.registrationId) : undefined;
  const phase: PaymentStatus = payment?.status === "pending" ? "processing" : (payment?.status ?? "processing");
  const remoteId = payment?.providerPaymentId;
  const tracking = LIVE && Boolean(remoteId) && !SETTLED.includes(phase);

  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!tracking || !remoteId || !payment) return;
    let cancelled = false;
    const localId = payment.id;

    async function verify() {
      try {
        const remote = await fetchPayment(remoteId as string);
        if (cancelled) return;
        setCheckedAt(new Date());
        setRemoteError(null);
        // The server has already verified this with the provider; mirror the outcome locally.
        if (remote.status === "paid" || remote.status === "failed" || remote.status === "cancelled") {
          pay(localId, remote.method, remote.status);
        }
      } catch (err) {
        if (!cancelled) setRemoteError(err instanceof PaymentApiError ? err.message : "Could not verify the payment status.");
      }
    }

    verify();
    const timer = window.setInterval(verify, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tracking, remoteId, payment, pay, refreshKey]);

  if (!payment || !bundle) {
    return <div className="nt-container" style={{ padding: 48 }}><EmptyState title="Payment not found" body="Return to checkout from your registration." /></div>;
  }

  const current = payment;
  function demo(outcome: "paid" | "failed" | "cancelled") { pay(current.id, current.method, outcome); }

  const title = phase === "paid" ? "Payment received" : phase === "failed" ? "Payment not completed" : phase === "cancelled" ? "Payment cancelled" : "Waiting for approval";
  const message = phase === "paid"
    ? "Your registration is confirmed. Your ticket and receipt are ready."
    : phase === "failed"
      ? LIVE ? "The provider reported that the payment did not complete. You can retry or choose another method." : "The simulated payment did not complete. You can retry or choose another method."
      : phase === "cancelled"
        ? "This payment attempt was cancelled or expired. Your registration can still be completed."
        : LIVE
          ? `Approve the ${paymentMethodLabel(payment.method)} prompt on ${bundle.attendee.phone}. This page updates automatically once the provider confirms.`
          : "Keep this page open while the simulated payment response is processed.";

  return (
    <div className="nt-container nt-page nt-form-page nt-payment-page" style={{ maxWidth: 760 }}>
      <Breadcrumbs items={[{ label: "Events", to: "/events" }, { label: bundle.event.title, to: `/events/${bundle.event.slug}` }, { label: "Payment" }]} />
      {!LIVE ? (
        <div className="nt-demo-controls no-print">
          <span>Demo controls</span>
          <button type="button" className="nt-chip" onClick={() => demo("paid")}>Success</button>
          <button type="button" className="nt-chip" onClick={() => demo("failed")}>Failure</button>
          <button type="button" className="nt-chip" onClick={() => demo("cancelled")}>Cancel</button>
        </div>
      ) : null}

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

        {tracking ? (
          <p className="nt-muted" role="status">
            {remoteError ? remoteError : checkedAt ? `Last verified with the provider at ${checkedAt.toLocaleTimeString()}.` : "Verifying with the provider…"}{" "}
            <button type="button" className="nt-chip" onClick={() => setRefreshKey((n) => n + 1)}>Check now</button>
          </p>
        ) : null}

        <div className="nt-payment-actions">
          {phase === "paid" ? (
            <>
              <Link to="/app/ticket" className="nt-btn">View ticket</Link>
              <Link to={`/receipt/${bundle.registration.id}`} className="nt-btn ghost">View receipt</Link>
            </>
          ) : LIVE ? (
            <Link to={`/checkout/${bundle.registration.id}`} className="nt-btn">{tracking ? "Change method or number" : "Try again"}</Link>
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

export function PaymentPage() {
  return LIVE ? <LivePaymentPage /> : <DemoPaymentPage />;
}

/** Live mode: the page renders the server's payment record and polls it until it settles. */
function LivePaymentPage() {
  const { paymentId = "" } = useParams();
  const { user, reload } = usePlatform();
  const [payment, setPayment] = useState<RemotePayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const settled = payment ? SETTLED.includes(payment.status) : false;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    async function verify() {
      try {
        const remote = await fetchPayment(paymentId);
        if (cancelled) return;
        setPayment(remote);
        setCheckedAt(new Date());
        setError(null);
        if (SETTLED.includes(remote.status)) {
          window.clearInterval(timer);
          if (user) void reload();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof PaymentApiError ? err.message : "Could not verify the payment status.");
      }
    }
    void verify();
    timer = window.setInterval(verify, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // reload and user are intentionally not dependencies: polling restarts only on a new payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, refreshKey]);

  async function resend() {
    setNotice(null);
    try {
      setPayment(await resendPaymentPrompt(paymentId));
      setNotice("A new prompt has been sent to your phone.");
    } catch (err) {
      setNotice(err instanceof PaymentApiError ? err.message : "Could not resend the prompt.");
    }
  }

  if (!payment) {
    return (
      <div className="nt-container" style={{ padding: 48 }}>
        {error ? <EmptyState title="Payment not found" body={error} /> : <p className="nt-muted" role="status">Checking your payment…</p>}
      </div>
    );
  }

  const phase: PaymentStatus = payment.status === "pending" ? "processing" : payment.status;
  const title = phase === "paid" ? "Payment received" : phase === "failed" ? "Payment not completed" : phase === "cancelled" ? "Payment cancelled" : "Waiting for approval";
  const body = phase === "paid"
    ? `Your registration is confirmed. Ticket ${payment.ticket_number}.`
    : phase === "failed"
      ? "The provider reported that the payment did not complete. You can try again."
      : phase === "cancelled"
        ? "This payment attempt was cancelled or expired. You can start again from the event page."
        : `Approve the ${paymentMethodLabel(payment.method)} prompt on your phone. This page updates automatically once the provider confirms.`;

  return (
    <div className="nt-container nt-page nt-form-page nt-payment-page" style={{ maxWidth: 760 }}>
      <Breadcrumbs items={[{ label: "Events", to: "/events" }, { label: payment.event_title, to: `/events/${payment.event_slug}` }, { label: "Payment" }]} />
      <article className="nt-card nt-payment-state-card">
        <div className={`nt-payment-state-icon ${phase}`} aria-hidden="true">
          {phase === "paid" ? "✓" : phase === "failed" ? "!" : phase === "cancelled" ? "×" : "…"}
        </div>
        <StatusPill value={phase} />
        <h1>{title}</h1>
        <p className="nt-lede">{body}</p>
        <div className="nt-payment-facts">
          <div><span>Amount</span><strong>{formatMoney(payment.amount, payment.currency)}</strong></div>
          <div><span>Method</span><strong>{paymentMethodLabel(payment.method)}</strong></div>
          <div><span>Reference</span><strong>{payment.reference}</strong></div>
          <div><span>Attendee</span><strong>{payment.attendee_name}</strong></div>
        </div>
        {!settled ? (
          <p className="nt-muted" role="status">
            {error ? error : checkedAt ? `Last verified with the provider at ${checkedAt.toLocaleTimeString()}.` : "Verifying with the provider…"}{" "}
            <button type="button" className="nt-chip" onClick={() => setRefreshKey((n) => n + 1)}>Check now</button>{" "}
            <button type="button" className="nt-chip" onClick={resend}>Resend prompt</button>
          </p>
        ) : null}
        {notice ? <p className="nt-muted" role="status">{notice}</p> : null}
        <div className="nt-payment-actions">
          {phase === "paid" ? (
            <>
              {user ? <Link to={`/app/ticket?registration=${payment.registration_id}`} className="nt-btn">View ticket</Link> : <Link to="/login" className="nt-btn">Sign in to view your ticket</Link>}
              <Link to={`/receipt/${payment.registration_id}?payment=${payment.id}`} className="nt-btn ghost">View receipt</Link>
            </>
          ) : settled ? (
            <Link to={`/register/${payment.event_slug}`} className="nt-btn">Try again</Link>
          ) : null}
        </div>
        <div className="nt-payment-event">{payment.event_title}</div>
      </article>
    </div>
  );
}
