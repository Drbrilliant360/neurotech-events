# Backend security baseline

The backend follows a defense-in-depth approach aligned with the OWASP Top 10 Web
Application Security Risks and OWASP API Security Top 10.

## Current controls

- **Broken access control:** authorization is evaluated server-side from platform,
  organization and event scopes. Frontend roles are never trusted.
- **Cryptographic failures:** passwords use Argon2; production/staging settings reject
  the development JWT secret and require a 32-character minimum secret.
- **Injection:** SQLAlchemy parameterization is used for database access; request
  payloads are validated with Pydantic.
- **Insecure design:** payment status, ticket pricing and registration eligibility
  remain server-owned domain decisions.
- **Security misconfiguration:** production/staging reject wildcard CORS and emit
  browser security headers. The static admin token is accepted only in development
  and test environments.
- **Identification and authentication failures:** access tokens are short-lived JWTs bound to
  issuer, audience and token type, and carry a `token_version` so sign-out-everywhere and
  password changes revoke them immediately. Refresh tokens are opaque, stored only as SHA-256
  digests, rotate on every use and revoke their whole family when a used token is replayed.
  Login spends equal time for unknown emails. Auth routes are rate-limited per IP, and failed
  (never successful) sign-ins lock an account per client IP with a looser account-wide ceiling.
- **Broken object-level authorization:** every organiser route resolves the event through one
  capability check (`view`, `manage`, `finance`, `check_in`) and loads child records scoped to
  that event. Users with no relationship to an event get `404`; door staff see names and ticket
  numbers only. Shared speakers and venues can be edited only by platform admins or owners/admins
  of every organization whose events use them.
- **Business-logic abuse:** checkout locks the event row (when event capacity applies) and the
  ticket row, re-reads payments under a lock before applying provider status, enforces ticket and event capacity plus
  registration and sales windows, and rate-limits payment starts (each one pushes a phone prompt).
  Ticket QR codes are HMAC-signed with a domain-separated key; ticket numbers carry 40 random bits.
- **Resource consumption:** request bodies over `MAX_REQUEST_BODY_BYTES` are rejected with `413`,
  collection endpoints are paginated with hard caps, and client polling of payment status is
  throttled before it reaches the provider.
- **Error handling:** unhandled, database and integrity errors return a generic envelope with a
  request id; validation errors never echo submitted input (passwords, tokens).
- **Audit:** logins (including failures), sign-outs, password changes, role assignments, event,
  ticket, programme, registration, export and check-in changes are written to `audit_logs`.
- **Data export:** CSV exports neutralise spreadsheet formulas (CSV injection).
- **Logging and monitoring:** payment provider events are persisted as an audit
  trail; credentials and tokens must not be logged.
- **SSRF and unsafe integrations:** provider URLs are configured server-side and
  external payment responses are validated before use.

## DevSecOps requirements

Before merging backend changes:

```bash
backend/.venv/bin/ruff check backend
backend/.venv/bin/pytest backend/tests
(cd backend && .venv/bin/alembic check)
npm run check
npm audit --omit=dev --audit-level=high
# With pip-audit and Bandit installed in the active backend environment:
(cd backend && pip-audit --local --skip-editable)
(cd backend && bandit -c pyproject.toml -r app --severity-level medium --confidence-level medium)
```

CI also scans the complete Git history with Gitleaks. See the repository
[`SECURITY.md`](../SECURITY.md) and `.github/workflows/security.yml` for gate scope and
scanner pins.

Do not commit `.env`, `.env.local`, `.neon`, tokens, private keys or provider
credentials. Every new protected route requires explicit `401`, `403`, and
resource-ownership tests where applicable. Every schema change requires an Alembic
migration and validation against SQLite tests and Neon PostgreSQL before release.

## Remaining security work

- Add rate limiting and abuse monitoring at the deployment edge (the in-process limiter is
  per worker).
- Add email verification and a password-reset flow (needs an email provider contract).
- Move the refresh token to an `HttpOnly`, `Secure`, `SameSite` cookie once the frontend and
  API share a site; until then the frontend must keep it out of `localStorage` where possible.
- Replace the legacy `PUT /admin/catalogue` super-admin sync with the scoped organiser API.
- Add authenticated DAST once a stable deployed test environment and seeded test account are available; dependency, secret and Python SAST checks now run in CI.
- Ticket QR payloads use `TICKET_SIGNING_KEY`, which hardened environments require to be at
  least 32 characters, non-default and distinct from `JWT_SECRET_KEY`. Generate both independently.
- There is intentionally no fallback to `JWT_SECRET_KEY` or a previous ticket key: accepting an
  old compromised key would preserve its ability to forge admission. Rotating `TICKET_SIGNING_KEY`
  therefore invalidates previously rendered/downloaded QR payloads. Existing confirmed registrations
  remain valid and the attendee ticket endpoint immediately issues a fresh QR under the current key;
  operators must notify attendees to refresh/re-download tickets and replace any printed tickets as
  part of a planned rotation. Ticket-number lookup remains available as the controlled recovery path.

## Offline check-in boundary

Offline manifests are short-lived, event-scoped and signed with a domain-separated HMAC key.
They intentionally contain only minimum door data and are limited to 5,000 confirmed tickets to
bound response/storage size. The browser cannot create authoritative check-ins: offline matches
are provisional until the authenticated reconciliation endpoint validates the manifest and current
server state. Reconciliation requires event `check_in` capability, uses unique client operation IDs,
and audits the operator plus a SHA-256 device pseudonym (not user-agent, location, or hardware data).
Manifest and queue persistence is limited to IndexedDB; access/refresh tokens are not copied there.
A compromised unlocked door device can expose the cached display names and ticket identifiers until
site data is cleared, so operators should use managed devices and clear storage after the event.
