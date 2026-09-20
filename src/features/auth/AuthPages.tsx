import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlatform } from "../../app/providers/PlatformProvider";

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
        <p className="nt-auth-note">Demo mode only. Passwords are validated in this browser and are never saved or sent anywhere.</p>
      </section>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setRole } = usePlatform();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for the demo password.");
    setRole("attendee");
    navigate("/app");
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Your next event is waiting." copy="Sign in to view your tickets, saved sessions, notifications and event history.">
      <form className="nt-auth-form" onSubmit={submit} noValidate>
        <label className="nt-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="nt-field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <div className="nt-auth-form-row"><label className="nt-auth-checkbox"><input type="checkbox" /> <span>Remember this device</span></label><Link to="/forgot-password">Forgot password?</Link></div>
        {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
        <button type="submit" className="nt-btn accent">Sign in to my events</button>
      </form>
      <p className="nt-auth-switch">New to Neurotech Events? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}

export function CreateAccountPage() {
  const navigate = useNavigate();
  const { setRole } = usePlatform();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (!isEmail(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use at least 8 characters for the demo password.");
    if (!accepted) return setError("Accept the demo terms to continue.");
    setRole("attendee");
    navigate("/app");
  }

  return (
    <AuthShell eyebrow="Create your account" title="Keep every event close." copy="One account brings your registrations, tickets, schedules and event history together.">
      <form className="nt-auth-form" onSubmit={submit} noValidate>
        <label className="nt-field"><span>Full name</span><input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" /></label>
        <label className="nt-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="nt-field"><span>Create a password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <label className="nt-auth-checkbox"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> <span>I understand this is a frontend demonstration and no real account will be created.</span></label>
        {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
        <button type="submit" className="nt-btn accent">Create my account</button>
      </form>
      <p className="nt-auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
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
    <AuthShell eyebrow="Password reset" title="Get back to your events." copy="Enter your email and we’ll show the reset step a connected authentication service would send.">
      {sent ? (
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
