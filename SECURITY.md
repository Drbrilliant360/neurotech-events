# Security Policy — NeuroTech Events

NeuroTech Events handles workflows that may eventually include attendee identity data, registration records, tickets, payments, communications, and administrative operations. Security requirements therefore apply from the frontend prototype stage onward.

## Reporting a vulnerability

Do not open a public issue containing exploit details, credentials, private attendee data, or other sensitive security information.

Report security findings privately to the repository/project maintainers through the approved private communication channel for the project. Include:

- affected component/path;
- reproduction steps;
- impact;
- proof of concept where safe;
- recommended mitigation if known.

## Secrets and configuration

Never commit:

- API keys;
- bearer/access/refresh tokens;
- passwords;
- private keys or certificates;
- payment-provider secrets;
- webhook signing secrets;
- database credentials;
- production `.env` files.

Browser-delivered configuration must be treated as public. A value being exposed through a Vite environment variable does not make it secret.

## Frontend security baseline

- Do not render untrusted HTML without an approved sanitization strategy.
- Reject unsafe URL schemes and preserve the URL checks in `src/lib/dcRender.tsx` when modifying the design renderer.
- Do not place authorization decisions solely in frontend state.
- Do not trust client-supplied ticket price, event capacity, payment state, role, or entitlement.
- Minimize storage of personal data in browser persistence.
- Prefer secure server-managed session patterns over long-lived sensitive tokens in `localStorage` where the backend architecture permits.
- Validate upload type/size in the client for UX, while enforcing validation again on the server.

## Authentication and authorization

Once authentication is introduced:

- protected API operations must enforce identity and authorization server-side;
- differentiate unauthenticated (`401`) and forbidden (`403`) responses;
- check resource ownership/role permissions to prevent IDOR;
- expire/revoke sessions appropriately;
- avoid exposing privileged admin functionality through security-by-obscurity.

## Payment security

Payment truth must come from server-side provider verification.

The frontend must never:

- contain provider secret keys;
- mark a payment successful solely because the user reached a success page;
- accept a browser-supplied amount as authoritative;
- store raw card/payment credentials.

Payment integrations should use idempotent server operations, signed callbacks/webhooks, and reconciliation for delayed/duplicate provider events.

## Dependency security

Review dependency changes deliberately. Do not add a dependency for functionality that can be implemented safely with the existing stack without clear benefit.

When dependency/security automation is introduced, resolve critical/high findings before production deployment or document an explicit risk acceptance.

## Logging and privacy

Do not log:

- passwords or tokens;
- full payment credentials;
- unnecessary attendee personal data;
- private authentication headers.

Production observability should use structured logs and correlation IDs while minimizing personal data.

## Security-sensitive changes

Changes affecting the following require explicit review and documentation:

- authentication/session management;
- role/permission enforcement;
- registration/ticket entitlement;
- payments/refunds;
- QR/check-in validation;
- file uploads;
- external redirects/URLs;
- personal data storage/exports;
- admin audit operations.

See `docs/SYSTEM_ENGINEERING.md` for the broader system security boundary.
