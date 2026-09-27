import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";
import { accountPathFor } from "../../lib/routes";
import { ApiError, isApiEnabled } from "../../services/api";
import {
  confirmEmailVerification,
  confirmPasswordReset,
  login as apiLogin,
  register as apiRegister,
  requestPasswordReset,
  type AuthUser,
} from "../../services/auth";
import { BrandLogo } from "../../components/shared/BrandLogo";

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
          <BrandLogo />
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

/** Open the workspace the server says this account may use (organiser console or attendee). */
function useEnterWorkspace() {
  const navigate = useNavigate();
  const { signInWithAccount } = usePlatform();
  return async (user: AuthUser) => {
    const role = await signInWithAccount(user);
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
      await enter(await apiLogin(email.trim(), password));
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
      await enter(await apiRegister({ email: email.trim(), password, full_name: fullName.trim() }));
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
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) return setError("Enter a valid email address.");
    setError("");
    if (!LIVE) return setSent(true);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not request a reset. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="Password reset" title="Get back to your events." copy="Enter your email and we’ll send reset instructions if an eligible account exists.">
      {sent ? (
        <div className="nt-auth-success" role="status">
          <span aria-hidden="true">✓</span>
          <div><strong>Check your email</strong><p>If an eligible account exists for {email}, reset instructions are on their way.</p></div>
          <Link to="/login" className="nt-btn accent">Back to sign in</Link>
        </div>
      ) : (
        <form className="nt-auth-form" onSubmit={submit} noValidate>
          <label className="nt-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
          <button type="submit" className="nt-btn accent" disabled={busy}>{busy ? "Sending…" : "Send reset instructions"}</button>
        </form>
      )}
      <p className="nt-auth-switch"><Link to="/login">← Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return setError("This reset link is incomplete.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true); setError("");
    try { await confirmPasswordReset(token, password); setDone(true); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not reset your password."); }
    finally { setBusy(false); }
  }
  return <AuthShell eyebrow="Password reset" title="Choose a new password." copy="This link can be used once and expires shortly.">
    {done ? <div className="nt-auth-success" role="status"><span>✓</span><div><strong>Password updated</strong><p>All existing sessions were signed out.</p></div><Link className="nt-btn accent" to="/login">Sign in</Link></div> :
      <form className="nt-auth-form" onSubmit={submit}><label className="nt-field"><span>New password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <p className="nt-auth-error" role="alert">{error}</p> : null}<button className="nt-btn accent" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form>}
  </AuthShell>;
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"ready" | "busy" | "done">("ready");
  const [error, setError] = useState("");
  async function confirm() {
    if (!token) return setError("This verification link is incomplete.");
    setState("busy"); setError("");
    try { await confirmEmailVerification(token); setState("done"); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not verify your email."); setState("ready"); }
  }
  return <AuthShell eyebrow="Email verification" title="Confirm your email." copy="Verification protects your account and event history.">
    {state === "done" ? <div className="nt-auth-success" role="status"><span>✓</span><div><strong>Email verified</strong><p>You can now sign in.</p></div><Link className="nt-btn accent" to="/login">Sign in</Link></div> : <div className="nt-auth-form">{error ? <p className="nt-auth-error" role="alert">{error}</p> : null}<button className="nt-btn accent" onClick={confirm} disabled={state === "busy"}>{state === "busy" ? "Verifying…" : "Verify email"}</button></div>}
  </AuthShell>;
}
