import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { EmptyState } from "../../components/shared/Widgets";
import { formatMoney } from "../../lib/money";
import { eventBySlug, quoteTotals, ticketsFor } from "../../repositories/platform";

const STEPS = ["Ticket", "Details", "Review"];

export function RegisterPage() {
  const { eventId = "" } = useParams();
  const { db, register } = usePlatform();
  const navigate = useNavigate();
  const event = eventBySlug(db, eventId) ?? db.events.find((item) => item.id === eventId);
  const tickets = event ? ticketsFor(db, event.id).filter((ticket) => ticket.active && ticket.sold < ticket.capacity) : [];
  const [step, setStep] = useState(0);
  const [ticketId, setTicketId] = useState(tickets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    organization: "",
    jobTitle: "",
    country: "Tanzania",
    roleTitle: "",
    dietary: "",
    accessibility: "",
    interests: "AI, BCI",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ticket = tickets.find((item) => item.id === ticketId) ?? tickets[0];
  const totals = quoteTotals(ticket?.price ?? 0, db.settings.vatPercent);

  if (!event) return <div className="nt-container" style={{ padding: 48 }}><EmptyState title="Event not found" body="Choose another event to register." /></div>;
  if (event.status === "draft" || event.status === "cancelled") {
    return <div className="nt-container" style={{ padding: 48 }}><EmptyState title="Registration closed" body="This event is not open for registration." /></div>;
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.fullName.trim()) next.fullName = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email.";
    if (form.phone.replace(/\D/g, "").length < 9) next.phone = "Enter a phone number.";
    if (!form.organization.trim()) next.organization = "Enter your organization.";
    if (!form.jobTitle.trim()) next.jobTitle = "Enter your role or title.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (busy || !ticket || !event) return;
    setBusy(true);
    setFormError("");
    try {
      const result = register({
        eventId: event.id,
        ticketTypeId: ticket.id,
        attendee: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          organization: form.organization.trim(),
          jobTitle: form.jobTitle.trim(),
          country: form.country,
          roleTitle: form.roleTitle || form.jobTitle,
          dietary: form.dietary,
          accessibility: form.accessibility,
          interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean),
        },
      });
      navigate(`/checkout/${result.registration.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create registration.");
      setBusy(false);
    }
  }

  return (
    <div className="nt-container nt-page" style={{ maxWidth: 880, padding: "44px 24px 90px" }}>
      <h1>Register for {event.title}</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {STEPS.map((label, index) => (
          <div key={label} className={`nt-chip ${index === step ? "is-on" : ""}`}>
            0{index + 1} {label}
          </div>
        ))}
      </div>
      <div className="nt-card" style={{ padding: 32 }}>
        {step === 0 ? (
          <div>
            <h2>Select your ticket</h2>
            <div className="nt-grid">
              {tickets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`nt-choice ${item.id === ticket?.id ? "is-on" : ""}`}
                  onClick={() => setTicketId(item.id)}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <div className="nt-muted">
                      {item.perks} · {item.sold}/{item.capacity} sold
                    </div>
                  </div>
                  <div>{formatMoney(item.price, item.currency)}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <div>
            <h2>Attendee information</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
              {(
                [
                  ["fullName", "Full name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["organization", "Organization"],
                  ["jobTitle", "Role / title"],
                  ["country", "Country"],
                  ["dietary", "Dietary (optional)"],
                  ["accessibility", "Accessibility (optional)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="nt-field">
                  <span>{label}</span>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    aria-invalid={Boolean(errors[key])}
                  />
                  {errors[key] ? <div className="error">{errors[key]}</div> : null}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div>
            <h2>Review</h2>
            <p>
              {form.fullName} · {form.email}
              <br />
              {ticket?.name} · {formatMoney(totals.subtotal)} + VAT {formatMoney(totals.vat)} = <strong>{formatMoney(totals.total)}</strong>
            </p>
            {formError ? <p className="error">{formError}</p> : null}
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
          {step === 0 ? (
            <Link to={`/events/${event.slug}`} className="nt-btn ghost">
              Back
            </Link>
          ) : (
            <button type="button" className="nt-btn ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              className="nt-btn"
              onClick={() => {
                if (step === 1 && !validate()) return;
                setStep(step + 1);
              }}
            >
              Continue
            </button>
          ) : (
            <button type="button" className="nt-btn" disabled={busy} onClick={submit}>
              {busy ? "Submitting…" : "Go to checkout"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
