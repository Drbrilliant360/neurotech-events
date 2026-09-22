# Neurotech Events Backend

This directory is reserved for the FastAPI backend of Neurotech Events.

The repository is intentionally being evolved as a monorepo:

- the existing React/Vite application remains the frontend;
- the FastAPI application will provide the production API;
- both applications share product documentation and are validated through GitHub Actions;
- deployment can scale each application independently without splitting the repository prematurely.

No backend implementation is included yet. This document is the implementation contract for the agents and contributors who will build it in phases.

## Backend objectives

The backend must replace the current browser-only demo repository with server-owned:

- identity, authentication and authorization;
- organizations and event-level administration;
- events, venues, speakers and sessions;
- ticket types, inventory and ticket entitlements;
- registrations and attendee profiles;
- payment intents, provider callbacks, refunds and receipts;
- attendee schedules, networking and notifications;
- check-in and audit history;
- communications, sponsors, certificates and reports.

The frontend reference implementation is under `src/`. Important current contracts are in:

- `src/domain/types.ts`
- `src/app/router/AppRouter.tsx`
- `src/app/providers/PlatformProvider.tsx`
- `src/repositories/platform.ts`
- `src/data/seed/database.ts`

The Postman contract for the planned API is under `postman/`.

## Recommended architecture

Start with a **modular monolith**, not microservices.

The backend should have one deployable FastAPI application and explicit internal domain modules. This gives the team:

- one transactional database boundary;
- simpler local development and deployment;
- one versioned API for the frontend;
- clear ownership boundaries;
- a future path to extract high-scale modules such as payments or communications.

The backend must not expose SQLAlchemy models directly from route handlers. Keep these boundaries:

```text
HTTP router -> Pydantic schema -> application service -> domain rules -> repository -> database
                                                     |
                                                     +-> external integration ports
```

Recommended layout:

```text
backend/
  README.md
  pyproject.toml
  .env.example
  Dockerfile
  alembic.ini
  app/
    main.py
    config.py
    logging.py
    api/
      deps.py
      errors.py
      v1/
        router.py
        auth.py
        public_events.py
        registrations.py
        payments.py
        attendee.py
        networking.py
        notifications.py
        certificates.py
        checkins.py
        admin_events.py
        admin_program.py
        admin_tickets.py
        admin_attendees.py
        admin_communications.py
        admin_sponsors.py
        admin_reports.py
        admin_settings.py
        webhooks.py
    domain/
      identity/
      organizations/
      events/
      program/
      ticketing/
      registrations/
      attendees/
      payments/
      checkin/
      communications/
      networking/
      certificates/
      reporting/
    schemas/
    services/
    repositories/
    integrations/
      payments/
      messaging/
      storage/
    db/
      session.py
      base.py
      models/
    migrations/
  tests/
    unit/
    integration/
    api/
```

The exact module names may evolve, but domain rules should remain separate from HTTP and persistence concerns.

## API conventions

All public API routes should be versioned:

```text
/api/v1/...
```

The initial API should expose:

- public event discovery and program data;
- authentication and current-user operations;
- attendee registration, ticketing, payments and personal data;
- admin event, program, ticket, attendee, check-in and reporting operations;
- provider webhooks.

Use:

- JSON request and response bodies;
- ISO 8601 timestamps with timezone information;
- opaque IDs;
- pagination for growing collections;
- consistent machine-readable error codes;
- `401` for unauthenticated requests;
- `403` for authenticated users without permission;
- `404` without leaking resource existence where appropriate;
- idempotency keys for registration, payment and check-in mutations.

FastAPI should publish:

```text
GET /health
GET /docs
GET /openapi.json
```

The OpenAPI document is the authoritative API contract. The Postman collection is a convenient manual testing client and must be updated when the contract changes.

## Data and security rules

The backend is authoritative for:

- roles and permissions;
- event lifecycle and registration windows;
- ticket prices and availability;
- payment status;
- refunds;
- attendee ownership;
- check-in eligibility;
- certificate eligibility.

Never trust these values from the browser.

Production requirements:

- PostgreSQL or an equivalent transactional relational database;
- Alembic migrations;
- server-side validation with Pydantic and domain rules;
- secure password hashing;
- secure session or short-lived token strategy defined by an ADR;
- event/organization-scoped authorization;
- audit records for money, identity, publishing, check-in and admin changes;
- secrets supplied through environment or deployment secret stores;
- no production credentials in this repository;
- structured logs without passwords, tokens or unnecessary personal data.

Payment integrations must use provider verification and signed webhooks. The frontend must never determine whether a payment succeeded.

## Phased delivery plan

### Phase 0 — Contract and scaffolding

Deliver:

- backend architecture ADR;
- FastAPI application factory;
- configuration and `.env.example`;
- health endpoint;
- `/api/v1` router;
- database session and migration baseline;
- error envelope;
- CI job that installs and validates the backend;
- initial OpenAPI metadata.

Exit criteria:

- the backend starts locally;
- `/health`, `/docs` and `/openapi.json` work;
- no domain workflow is implemented yet;
- frontend CI remains green.

### Phase 1 — Identity and authorization

Deliver:

- user/account model;
- attendee profile model;
- organization model;
- roles and permissions;
- registration/login/logout/current-user flows;
- protected route dependencies;
- event-level authorization policy;
- tests for ownership and forbidden access.

Recommended initial roles:

```text
attendee
event_staff
event_admin
platform_admin
```

### Phase 2 — Public events and program

Deliver:

- venues;
- events and lifecycle;
- speakers;
- rooms/tracks if required;
- sessions;
- public list/detail endpoints;
- admin event and session management;
- slug uniqueness and publish validation.

Connect the frontend public routes only after response schemas are stable.

### Phase 3 — Ticketing and registration

Deliver:

- ticket types;
- inventory reservations;
- registration creation and cancellation;
- ticket entitlements;
- duplicate registration policy;
- capacity enforcement;
- idempotency;
- attendee registration and ticket endpoints.

Inventory must be updated transactionally. Do not recreate the frontend `sold` counter as the only source of truth.

### Phase 4 — Payments

Deliver:

- payment intent abstraction;
- provider adapter interface;
- payment attempts;
- webhook verification;
- reconciliation;
- refunds;
- receipts;
- payment audit events.

Begin with a deterministic fake provider for development and tests. Add a real provider only after its contract and secrets are approved.

### Phase 5 — Attendee experience

Deliver:

- dashboard read model;
- personal schedule;
- networking;
- notifications;
- profile preferences;
- event history;
- certificate eligibility and verification.

### Phase 6 — Operations and check-in

Deliver:

- scoped attendee search;
- check-in token/QR contract;
- check-in and undo audit history;
- offline requirements decision;
- admin exports;
- operational reports.

### Phase 7 — Communications, media and scale

Deliver:

- communications and audience resolution;
- provider delivery records and retries;
- consent/unsubscribe handling;
- object storage and signed media URLs;
- background workers;
- rate limiting;
- observability and alerting;
- retention and deletion workflows.

## Monorepo and shipping strategy

Keep the backend in this repository under `backend/` for now. This is the best choice because the frontend and backend share:

- one product domain;
- one API contract;
- one Postman collection;
- one pull-request review process;
- coordinated feature delivery.

Deployments should still be independently buildable:

```text
frontend artifact -> static hosting/CDN
backend artifact   -> container/platform runtime
database           -> managed PostgreSQL
workers            -> separate process using the same backend package
```

Use path-aware CI so frontend-only changes do not require backend deployment, while backend changes run backend checks. A production pipeline should eventually contain:

1. frontend lint/type/build;
2. backend format/lint/type/test;
3. migration validation;
4. OpenAPI contract validation;
5. dependency and secret scanning;
6. container build;
7. deploy to staging;
8. smoke tests;
9. controlled production promotion.

Database migrations must run as a deliberate deployment step. Application startup should not silently mutate production schemas.

## Local development target

The eventual local development commands should be documented here as the backend is implemented. The expected shape is:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The frontend should continue to run separately:

```bash
npm ci
npm run dev
```

The frontend API base URL should be configured through a browser-safe Vite variable once API integration starts.

## Definition of done for backend phases

Every phase must include:

- domain and API schemas;
- authorization rules;
- migration(s);
- unit tests for business invariants;
- API/integration tests for successful and rejected requests;
- updated OpenAPI/Postman contract;
- structured error handling;
- documentation of security and operational impact;
- CI validation;
- a focused pull request.

Do not begin the next phase by hiding unfinished behavior behind broad mocks. Mocks are acceptable at explicit integration boundaries, especially payment and messaging providers, but domain rules must be real and tested.
