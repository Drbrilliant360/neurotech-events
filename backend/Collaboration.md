# Backend Collaboration Guide

This guide is the shared operating agreement for contributors and coding agents working on the FastAPI backend.

## Source of truth

Read these documents before implementing a backend change:

1. [`backend/README.md`](./README.md) — architecture, API conventions and current phase plan.
2. [`backend/IMPLEMENTATION_LOG.md`](./IMPLEMENTATION_LOG.md) — chronological record of completed work, validation and decisions.
3. [`docs/PRODUCT_REQUIREMENTS.md`](../docs/PRODUCT_REQUIREMENTS.md) — product behavior and roles.
4. [`docs/SYSTEM_ENGINEERING.md`](../docs/SYSTEM_ENGINEERING.md) — security, reliability and integration boundaries.
5. [`postman/neurotech-events.postman_collection.json`](../postman/neurotech-events.postman_collection.json) — manual API contract client.

If implementation and documentation disagree, verify the code and tests first, then update both records in the same change.

## Working branch

Backend implementation belongs on the long-lived `feat/backend` branch. Do not create a branch for every phase unless the maintainer explicitly requests it.

Before starting:

```bash
cd "/Users/remnant01/Documents/Neurotech Summit/neurotech-events"
git switch feat/backend
git status
git pull --ff-only origin feat/backend
```

Keep unrelated local changes, including untracked Postman files, untouched.

## Implementation rules

- Use the modular-monolith structure under `backend/`.
- Keep HTTP routes, Pydantic schemas, application services, domain rules, repositories and persistence concerns separate.
- Treat the backend as authoritative for identity, authorization, event state, ticket inventory, registration ownership, payment state and check-in eligibility.
- Do not invent live provider endpoints. Define an interface and keep integrations mocked until a contract is approved.
- Do not expose SQLAlchemy models directly from route handlers.
- Use migrations for schema changes; never rely on manually edited local databases.
- Add or update tests for every endpoint, authorization rule and state transition that changes.
- Update the Postman collection when a public request or response contract changes.
- Never commit secrets, local databases, virtual environments, generated caches or provider credentials.

## Change sequence

For each meaningful slice:

1. Identify the frontend workflow and domain contract.
2. Define or update persistence models and migration requirements.
3. Define Pydantic request and response schemas.
4. Implement domain/application behavior behind the API route.
5. Add authorization and negative-path tests, not only happy-path tests.
6. Update `README.md`, `IMPLEMENTATION_LOG.md` and Postman when applicable.
7. Run targeted checks, then the full backend checks.
8. Commit one focused unit with an imperative conventional-commit message.

## Validation commands

From the repository root:

```bash
backend/.venv/bin/ruff check backend
backend/.venv/bin/pytest backend/tests
backend/.venv/bin/alembic -c backend/alembic.ini check
```

For a local API smoke test:

```bash
backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload
```

The minimum expected API checks are:

```text
GET /health
GET /api/v1/meta
GET /openapi.json
```

## Documentation update rule

At the end of every backend implementation slice, append an entry to [`IMPLEMENTATION_LOG.md`](./IMPLEMENTATION_LOG.md) containing:

- date;
- phase;
- concise change summary;
- files or contract surfaces affected;
- validation performed;
- remaining follow-up work.

Keep the phase table in [`README.md`](./README.md) synchronized with the log. The log is append-only apart from correcting factual errors.

## Pull requests

Backend pull requests should target `main` and include:

- scope and phase;
- API and database changes;
- authorization and security impact;
- validation commands and results;
- migration instructions, if applicable;
- known limitations and follow-up work.

Do not merge a backend pull request until CI passes and the migration, API contract and tests have been reviewed together.
