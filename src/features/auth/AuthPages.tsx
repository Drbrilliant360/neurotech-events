import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { accountPathFor } from "../../lib/routes";
import { ApiError, isApiEnabled } from "../../services/api";
import { login as apiLogin, register as apiRegister, roleToDemoRole, setAuthToken, type AuthUser } from "../../services/auth";

const LIVE = isApiEnabled();

function isEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function AuthShell({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: ReactNode }) {
  return (
    <div className="nt-auth-page">
      <div className="nt-auth-orbit nt-auth-orbit-one" aria-hidden="true" />
      <div className="nt-auth-orbit nt-auth-orbit-two" aria-hidden="true" />
      <section className="nt-auth-card">
        <Link to="/" className="nt-auth-brand" aria-label="Neurotech Events home">
          <span className="nt-mark" />
          <span><strong>Neurotech Events</strong><small>by Neurotech Africa</small></span>
        </Link>
        <div className="nt-auth-heading">
          <p className="nt-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
        {children}
        <p className="nt-auth-note">
          {LIVE
            ? "Sign-in is handled by the Neurotech Events API. Your password is never stored in this browser."
            : "Demo mode only. Passwords are validated in this browser and are never saved or sent anywhere."}
        </p>
      </section>
    </div>
  );
}

/** Attach a server account to a local attendee record and open the right workspace. */
function useEnterWorkspace() {
  const navigate = useNavigate();
  const { signIn, ensureLocalAttendee } = usePlatform();
  return (user: AuthUser) => {
    const role = roleToDemoRole(user.role);
    const attendeeId = ensureLocalAttendee({
      email: user.email,
      fullName: user.full_name,
      phone: user.profile?.phone ?? undefined,
      organization: user.profile?.organization ?? undefined,
      jobTitle: user.profile?.job_title ?? undefined,
      country: user.profile?.country ?? undefined,
      interests: user.profile?.interests ?? undefined,
    });
    signIn(role, attendeeId);
    navigate(accountPathFor(role));
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const { db, signIn } = usePlatform();
  const enter = useEnterWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    setError("");
    if (!LIVE) {
      // Demo: match a known attendee by email, otherwise use the demo attendee.
      const match = db.attendees.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
      signIn("attendee", match?.id);
      navigate("/app");
      return;
    }
    setBusy(true);
    try {
      const result = await apiLogin(email.trim(), password);
      setAuthToken(result.access_token);
      enter(result.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Your next event is waiting." copy="Sign in to view your tickets, saved sessions, notifications and event history.">
      <form className="nt-auth-form" onSubmit={submit} noValidate>
        <label className="nt-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="nt-field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <div className="nt-auth-form-row"><span /><Link to="/forgot-password">Forgot password?</Link></div>
        {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
        <button type="submit" className="nt-btn accent" disabled={busy}>{busy ? "Signing in…" : "Sign in to my events"}</button>
      </form>
      <p className="nt-auth-switch">New to Neurotech Events? <Link to="/register">Create an account</Link></p>
      {!LIVE ? (
        <div className="nt-auth-demo-roles" aria-label="Demo workspaces">
          <span className="nt-muted">Demo shortcuts</span>
          <button type="button" className="nt-chip" onClick={() => { signIn("attendee"); navigate("/app"); }}>Open attendee workspace</button>
          <button type="button" className="nt-chip" onClick={() => { signIn("admin"); navigate("/admin"); }}>Open admin console</button>
        </div>
      ) : null}
    </AuthShell>
  );
}

export function CreateAccountPage() {
  const navigate = useNavigate();
  const { signIn, ensureLocalAttendee } = usePlatform();
  const enter = useEnterWorkspace();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (!isEmail(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (!accepted) return setError("Accept the terms to continue.");
    setError("");
    if (!LIVE) {
      const attendeeId = ensureLocalAttendee({ email: email.trim(), fullName: fullName.trim() });
      signIn("attendee", attendeeId);
      navigate("/app");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRegister({ email: email.trim(), password, full_name: fullName.trim() });
      setAuthToken(result.access_token);
      enter(result.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Create your account" title="Keep every event close." copy="One account brings your registrations, tickets, schedules and event history together.">
      <form className="nt-auth-form" onSubmit={submit} noValidate>
        <label className="nt-field"><span>Full name</span><input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" /></label>
        <label className="nt-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="nt-field"><span>Create a password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <label className="nt-auth-checkbox">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />{" "}
          <span>{LIVE ? "I accept the event terms and privacy notice." : "I understand this is a frontend demonstration and no real account will be created."}</span>
        </label>
        {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
        <button type="submit" className="nt-btn accent" disabled={busy}>{busy ? "Creating account…" : "Create my account"}</button>
      </form>
      <p className="nt-auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { db } = usePlatform();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) return setError("Enter a valid email address.");
    setError("");
    setSent(true);
  }

  return (
    <AuthShell eyebrow="Password reset" title="Get back to your events." copy={LIVE ? "Self-service password reset is not available yet. The events team can reset your password for you." : "Enter your email and we’ll show the reset step a connected authentication service would send."}>
      {LIVE ? (
        <div className="nt-auth-success" role="status">
          <span aria-hidden="true">✉</span>
          <div><strong>Contact the events team</strong><p>Email {db.settings.contactEmail} from the address on your account and we will reset your password.</p></div>
          <a href={`mailto:${db.settings.contactEmail}?subject=Password%20reset`} className="nt-btn accent">Email {db.settings.contactEmail}</a>
        </div>
      ) : sent ? (
        <div className="nt-auth-success" role="status">
          <span aria-hidden="true">✓</span>
          <div><strong>Reset link prepared</strong><p>In production, a reset email would be sent to {email}. No email is sent from this frontend demo.</p></div>
          <Link to="/login" className="nt-btn accent">Back to sign in</Link>
        </div>
      ) : (
        <form className="nt-auth-form" onSubmit={submit} noValidate>
          <label className="nt-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
          <button type="submit" className="nt-btn accent">Send reset instructions</button>
        </form>
      )}
      <p className="nt-auth-switch"><Link to="/login">← Back to sign in</Link></p>
    </AuthShell>
  );
}
