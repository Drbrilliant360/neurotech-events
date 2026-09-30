# Implementation Plan — NeuroTech Events

This plan converts the original NeuroTech Events frontend prototype into a maintainable production application incrementally. It is intentionally structured so each phase can be delivered through small commits and reviewed PRs.

## Current implementation snapshot

_Last updated: 2026-09-30._

The product covers three user modes (public visitor, attendee, administrator) end to end against a real backend:

- **Frontend:** React 19 + TypeScript + Vite with React Router, typed domain models (`src/domain/types.ts`), feature folders (`src/features/`), and an API client (`src/services/`). With `VITE_API_BASE_URL` set, every collection comes from the API; without it the app runs as a local demo.
- **Backend:** FastAPI modular monolith in `backend/` with SQLAlchemy 2, Alembic migrations, 142 automated tests, and a Postman collection. See `backend/README.md` and `backend/IMPLEMENTATION_LOG.md`.
- **Identity:** accounts with Argon2 passwords, rotating refresh tokens, revocation, rate limits, audit log, and scoped roles (platform, organization, per-event staff) enforced server-side.
- **Payments:** Snippe mobile money with server-side pricing, signed webhooks and polling; the browser never marks anything paid.
- **Operations:** organiser CRUD for events, tickets, programme, speakers, venues, sponsors, team roles, communications; camera QR check-in with signed tickets; CSV export and reports.
- **Attendee:** tickets with signed QR, personal agenda, opt-in networking, in-app notifications, certificates with public verification.
- **Databases:** local PostgreSQL for testing; Neon serverless PostgreSQL reserved for production (deferred while testing).
- **Prototype artefacts** (`src/design/`, `src/lib/dcRender.tsx`, `src/lib/useAppModel.ts`) are kept as visual reference only.

Not yet built: a production email/SMS adapter (verification, reset and announcement messages are console-only locally), media uploads, card/bank payments, deployment. Refunds, offline check-in, email verification/reset and CI security scans landed on 2026-09-27.

## Delivery principles

Every implementation increment should:

1. be performed on the working branch (`feat/backend`) and reach `main` through a reviewed PR;
2. solve one coherent problem;
3. preserve currently working flows unless the change intentionally replaces them;
4. introduce explicit types/contracts before external integrations;
5. avoid coupling UI components directly to provider-specific APIs;
6. pass `npm run check` before PR completion;
7. update docs when behavior or architecture changes.

---

# Phase 0 — Repository engineering baseline

**Status (2026-09-27):** Complete.

**Goal:** make future implementation predictable and reviewable.

### Deliverables

- [x] `AGENTS.md`
- [x] Git workflow documentation
- [x] system engineering blueprint
- [x] implementation roadmap
- [x] pull request template
- [x] contribution guide
- [x] CI workflow for lint/build validation
- [x] ADR directory/template

### Exit criteria

New contributors can determine how to work, where to add code, how to validate it, and how changes reach `main` without tribal knowledge.

---

# Phase 1 — Stabilize the frontend architecture

**Status (2026-09-27):** Complete. React Router routes, shared domain types, feature folders and reusable widgets are in place; `useAppModel` remains only for the prototype renderer.

**Goal:** separate prototype navigation/state from production domain code without changing the visible product unnecessarily.

## 1.1 Introduce application routing

Replace string-only in-memory navigation with a proper router or an equivalent explicit route layer.

Target routes may include:

```text
/
/events
/events/:eventSlug
/speakers
/schedule
/register/:eventId
/checkout/:registrationId
/payment/:paymentId
/receipt/:registrationId

/app
/app/ticket
/app/schedule
/app/networking
/app/notifications
/app/certificates

/admin
/admin/events
/admin/events/new
/admin/tickets
/admin/attendees
/admin/check-in
/admin/schedule
/admin/timeline
/admin/poster
/admin/communications
/admin/sponsors
/admin/payments
/admin/reports
```

Do not lock these paths permanently before route requirements are reviewed.

## 1.2 Extract domain types

Create explicit types for:

- Event
- Venue
- Speaker
- Session
- TicketType
- Registration
- Attendee
- Payment
- Sponsor
- CheckIn
- Certificate
- Notification

Avoid defining the same object shape independently inside multiple components.

## 1.3 Split application state by concern

Move away from one large `useAppModel` for production behavior.

Suggested progression:

```text
useAppModel (prototype shell)
    ↓
domain models + feature hooks
    ↓
API/query state + UI-local state
```

UI-only selections such as active tabs can remain local. Server-owned state such as payment status should eventually come from the API.

## 1.4 Create reusable UI primitives

Extract stable elements such as:

- buttons;
- inputs/selects;
- cards;
- badges;
- modal/dialog patterns;
- table shells;
- page headers;
- status indicators;
- empty/loading/error states.

Do this only as repeated patterns justify it; avoid building an abstract design system before requirements are known.

### Phase 1 exit criteria

- navigation can survive refresh/deep-linking;
- major domain objects have shared TypeScript definitions;
- new business logic is not added to `App.tsx`;
- feature boundaries are visible in the source tree.

---

# Phase 2 — API boundary and data access

**Status (2026-09-27):** Complete. `src/services/api.ts` handles base URL, typed JSON, auth, refresh and normalised errors; `src/repositories/remote.ts` builds the page model from the API for every migrated domain.

**Goal:** make the frontend ready to connect to a real backend without binding components to raw HTTP calls.

## 2.1 Add API client infrastructure

Introduce a small API client supporting:

- base URL from environment configuration;
- JSON serialization;
- typed responses;
- authentication/session behavior once defined;
- normalized error handling;
- request cancellation/timeouts where appropriate.

## 2.2 Define service interfaces

Examples:

```ts
interface EventService {
  listEvents(): Promise<Event[]>;
  getEvent(idOrSlug: string): Promise<Event>;
  getSchedule(eventId: string): Promise<Session[]>;
}

interface RegistrationService {
  createRegistration(input: CreateRegistrationInput): Promise<Registration>;
  getRegistration(id: string): Promise<Registration>;
}
```

Provide mock/local implementations until the backend contract is approved.

## 2.3 Replace mock data one domain at a time

Recommended order:

1. events;
2. sessions/speakers;
3. ticket types;
4. attendee registration;
5. user ticket/dashboard;
6. admin event data;
7. payments;
8. check-in;
9. reports.

### Phase 2 exit criteria

Components consume domain services/hooks rather than embedded demo data for migrated domains.

---

# Phase 3 — Identity and access

**Status (2026-09-27):** Mostly complete. Sign-in/out, rotating refresh tokens, protected attendee/admin routes, server-side scoped permissions (ADR 0001) and expired-session handling are done. Email verification and self-service password reset are implemented; sending them in production needs an email provider adapter.

**Goal:** establish real public, attendee, and admin boundaries.

## Deliverables

- authentication/session strategy ADR;
- sign-in/sign-out flow if required;
- protected attendee routes;
- protected admin routes;
- server-defined role/permission contract;
- expired-session handling;
- unauthorized/forbidden states.

Important: frontend route guards improve UX but do not replace backend authorization.

### Phase 3 exit criteria

A user cannot obtain protected resources merely by changing a frontend route or client state.

---

# Phase 4 — Registration and ticketing

**Status (2026-09-27):** Complete. Oversell-safe checkout with seat holds and sales windows, free and complimentary tickets, persisted ownership, and signed QR tickets.

**Goal:** turn public interest into a durable attendee registration and ticket.

## Registration flow

1. user chooses event/ticket type;
2. frontend collects required attendee details;
3. API validates event/ticket availability;
4. registration is created as pending/confirmed according to ticket rules;
5. paid registrations proceed to checkout;
6. successful entitlement results in ticket issuance.

## Required behavior

- validation errors;
- ticket availability handling;
- duplicate submission protection;
- registration confirmation;
- attendee ticket display;
- QR/code representation when backend check-in contract is ready.

### Phase 4 exit criteria

Registration status and ticket ownership are persisted server-side and recoverable across devices/sessions.

---

# Phase 5 — Payments

**Status (2026-09-27):** Mostly complete. Snippe mobile money (server-created payments, signed race-safe webhooks, polling, late-payment recovery, receipts). Organiser refunds are paid out through Snippe. Remaining: card and bank methods.

**Goal:** implement payment without placing trust or secrets in the browser.

## Deliverables

- payment provider ADR;
- backend-created payment intent/request;
- checkout state UI;
- provider redirect/interaction where required;
- server-side callback/webhook verification;
- payment polling/status refresh or push strategy;
- receipt state;
- failed/cancelled/retry handling;
- reconciliation path for delayed callbacks.

### Phase 5 exit criteria

The browser never independently marks a registration as paid. Payment truth comes from the backend after provider verification.

---

# Phase 6 — Admin event operations

**Status (2026-09-27):** Complete for the listed sequence: event CRUD and publishing, tickets, speakers/venues/sessions, attendees, check-in, sponsors, communications (in-app delivery), payments, reports and CSV export, plus team and role management.

**Goal:** replace admin demo screens with real operational workflows.

Suggested sequence:

1. event CRUD + publishing;
2. ticket type management;
3. speaker/session management;
4. attendee listing/search/filter;
5. check-in operations;
6. sponsor management;
7. communications;
8. payment operations/reporting;
9. event reports/export.

Admin mutations should include clear success, error, loading, and confirmation states.

### Phase 6 exit criteria

An event operator can configure and run an event without direct database intervention.

---

# Phase 7 — Check-in and live-event resilience

**Status (2026-09-27):** Mostly complete. Camera QR scanning (native BarcodeDetector with jsQR fallback), signed-payload server validation, duplicate-scan handling with cooldown, manual lookup, undo, audit trail and scoped check-in staff. Offline manifests with idempotent reconciliation are implemented. Remaining: throughput testing.

**Goal:** support high-pressure event-day operations reliably.

## Deliverables

- QR/code scanner UX;
- server validation;
- duplicate scan behavior;
- manual search/check-in fallback;
- check-in audit record;
- operator permissions;
- network-failure strategy;
- throughput testing for expected event volume.

If offline check-in is required, design it explicitly; do not silently cache authoritative check-in state without conflict rules.

---

# Phase 8 — Communications, networking, certificates

**Status (2026-09-27):** Mostly complete. Organiser announcements and transactional notifications are delivered in-app; networking is opt-in and limited to people who share a confirmed registration; certificates are issued for checked-in attendees of completed events and verifiable at `/verify/:code`. Remaining: email/SMS/push delivery and notification preferences; downloadable certificate artefact beyond print.

**Goal:** complete attendee engagement features after the operational core is stable.

## Communications

- event announcements;
- transactional registration/payment notifications;
- schedule-change notifications;
- attendee notification preferences.

## Networking

Define privacy and consent rules before exposing attendee profiles to other attendees.

## Certificates

- eligibility rule;
- certificate generation;
- downloadable artifact;
- verification identifier/URL if required.

---

# Phase 9 — Reporting and analytics

**Status (2026-09-27):** Partial. Event summary, registrations, payments and check-in counts, and CSV export exist. Remaining: conversion funnel, attribution and session attendance.

**Goal:** provide operational visibility from trusted backend data.

Potential reports:

- registrations by ticket type;
- payment status/revenue;
- check-ins/attendance;
- session attendance where tracked;
- conversion funnel;
- campaign attribution where available;
- sponsor/event performance metrics.

Reports should identify source, timeframe, and metric definitions so dashboards do not become ambiguous.

---

# Phase 10 — Production hardening

**Status (2026-09-27):** In progress. Backend has 142 tests and CI; accessibility basics are applied to new screens. Dependency audits, Bandit SAST and gitleaks secret scanning run in CI. A Vitest + Testing Library harness covers login, session refresh, registration and check-in and runs in `npm run check`. Remaining: broader frontend coverage and a browser E2E suite, a focused security review, performance budgets, deployment and observability.

## Automated testing

Recommended layers:

- unit tests for domain/helpers;
- component tests for interaction-heavy UI;
- API integration tests;
- end-to-end tests for registration, payment-status recovery, ticket access, and check-in/admin critical paths.

## Accessibility

At minimum:

- keyboard navigation;
- meaningful focus states;
- semantic form labels;
- appropriate headings;
- accessible dialogs;
- meaningful alt text;
- sufficient contrast;
- reduced-motion consideration where relevant.

## Performance

Track:

- initial bundle size;
- image delivery;
- route-level loading;
- large admin tables;
- unnecessary rerenders;
- design JSON payload size if the renderer remains in production.

## Security

Complete a focused review covering:

- authentication/session handling;
- authorization/IDOR;
- input/output handling;
- secrets/config;
- payment verification;
- uploads;
- dependency vulnerabilities;
- rate limiting;
- audit logging.

---

# Next implementation work

The original first tickets (domain types, routing, service layer, CI) are done. Remaining work, in suggested order:

1. `test: extend frontend coverage (payments, admin CRUD) and add a browser E2E suite against a real API`
2. `feat: choose an email/SMS provider (ADR) and implement the notification port adapter`
3. `feat: media uploads for event artwork, speaker photos and sponsor logos`
4. `chore: deployment (API, web) and Neon production migration`
5. `feat: card and bank payments; check-in throughput testing`

Completed milestones are recorded in `backend/IMPLEMENTATION_LOG.md`.

# Documentation update rule

When a PR changes any of the following, the corresponding documentation must change in the same PR:

- architecture or directory boundaries;
- build/test commands;
- environment variables;
- authentication/session behavior;
- external integrations;
- payment flow;
- data model contracts;
- deployment process;
- Git/PR policy.
