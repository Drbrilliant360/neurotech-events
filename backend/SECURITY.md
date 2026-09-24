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
- **Identification and authentication failures:** bearer tokens are validated
  server-side and inactive users cannot authenticate.
- **Logging and monitoring:** payment provider events are persisted as an audit
  trail; credentials and tokens must not be logged.
- **SSRF and unsafe integrations:** provider URLs are configured server-side and
  external payment responses are validated before use.

## DevSecOps requirements

Before merging backend changes:

```bash
backend/.venv/bin/ruff check backend
backend/.venv/bin/pytest backend/tests
cd backend && .venv/bin/alembic check
npm run check
```

Do not commit `.env`, `.env.local`, `.neon`, tokens, private keys or provider
credentials. Every new protected route requires explicit `401`, `403`, and
resource-ownership tests where applicable. Every schema change requires an Alembic
migration and validation against SQLite tests and Neon PostgreSQL before release.

## Remaining security work

- Add refresh-token rotation and revocation.
- Add rate limiting and abuse monitoring at the deployment edge.
- Add security event/audit records for identity and authorization mutations.
- Replace remaining compatibility admin gates with scoped authorization.
- Add dependency, secret, SAST and DAST checks to CI.
