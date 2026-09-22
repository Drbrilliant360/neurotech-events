# Neurotech Events

Neurotech Events is the event experience for Neurotech Africa: a React + TypeScript platform for public event discovery, attendee accounts and event administration.

The current repository is a presentation-ready **frontend prototype**. It models the product flows and domain boundaries needed for production while keeping backend, identity, payment and notification integrations explicit future concerns.

## Product surfaces

### Public

- event discovery and event details;
- speakers and schedules;
- registration;
- checkout and payment-status UX;
- receipt flow;
- upcoming and past Neurotech event continuity.

### Attendee

- dashboard centered on the next registered event;
- ticket and check-in readiness;
- personal schedule;
- networking;
- notifications;
- certificates;
- profile;
- event history across Neurotech events.

### Admin

- operational dashboard;
- event creation and management;
- ticket configuration;
- attendees and check-in;
- schedule/timeline management;
- poster/communications/sponsors;
- payments and reports.

## Current architecture

The repository is a React 19 + TypeScript + Vite SPA.

Interactive product flows live under `src/features/`, typed domain models live in `src/domain/`, local repositories live in `src/repositories/`, and React Router routes live in `src/app/`. Demo data is seeded on first visit and persisted through repositories to `localStorage`. The prototype design renderer (`src/lib/dcRender.tsx`, `src/design/`) is retained as a visual reference.

This application is **frontend only**. There is no production backend, database, live payment provider, or production authentication. The Public / Attendee / Admin control is a demo identity switcher.

Reset demo data from the top bar when validating deterministic flows.

## Local development

```bash
npm ci
npm run dev
```

Production validation:

```bash
npm run check
```

Useful scripts:

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
npm run preview
```

## Engineering workflow

Implementation work should be made on `masterchanges` in small, focused commits and submitted through a pull request into `main`.

Do not implement directly on `main` unless the maintainer explicitly overrides the repository workflow.

Each material change should:

1. respect existing domain boundaries;
2. keep commits small and single-purpose;
3. update documentation when product or architecture behavior changes;
4. pass lint, typecheck and production build;
5. be reviewed through a pull request before `main` is changed.

## Engineering documentation

Read these before major implementation work:

- [`backend/README.md`](./backend/README.md) — FastAPI backend architecture, phased delivery plan and monorepo conventions.
- [`AGENTS.md`](./AGENTS.md) — rules for AI agents and contributors, including the required branch/commit/PR workflow.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution and implementation expectations.
- [`docs/PRODUCT_REQUIREMENTS.md`](./docs/PRODUCT_REQUIREMENTS.md) — product vision, user roles, required flows and production rules.
- [`docs/FRONTEND_DESIGN_SYSTEM.md`](./docs/FRONTEND_DESIGN_SYSTEM.md) — Neurotech-specific visual, responsive and interaction standards.
- [`docs/GIT_WORKFLOW.md`](./docs/GIT_WORKFLOW.md) — branch, commit, validation and PR process.
- [`docs/SYSTEM_ENGINEERING.md`](./docs/SYSTEM_ENGINEERING.md) — current system baseline, target boundaries, security, reliability, payments, check-in and observability.
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — phased roadmap from prototype to production.
- [`docs/FEATURE_BENCHMARK.md`](./docs/FEATURE_BENCHMARK.md) — feature benchmark against pretix, Ti.to, Sessionize and Eventbrite, with a prioritised build order.
- [`docs/adr/0000-template.md`](./docs/adr/0000-template.md) — architecture decision record template.
- [`SECURITY.md`](./SECURITY.md) — project security policy and security-sensitive implementation guidance.

## Source layout

```text
src/
  app/          Router, layouts, demo identity provider
  components/   Shared presentational widgets
  domain/       Typed event-platform contracts
  data/seed/    Deterministic mock dataset
  features/     Public, attendee and admin screens
  repositories/ Local persistence implementations
  lib/          Formatters, CSV, storage helper, prototype renderer
  styles/       Platform and Neurotech experience styles
  design/       Prototype/design source artifacts
  App.tsx       Application shell

backend/
  README.md     Backend architecture and phased implementation contract

postman/
  *.json        FastAPI contract-first collection and local environment
```

Frontend and backend connect through `src/services/` (a shared API client plus auth, payments and catalogue modules). With the API configured, sign-in and account creation use the backend, the profile page saves to the account, checkout shows the server-verified price and starts a real mobile-money payment, the payment page polls the server until Snippe confirms, admins publish the event and ticket catalogue to the payments server from the Tickets page, and platform admins see every transaction under Finance. Without it the site runs as a local demo.

Navigation: on phones and tablets the public site uses a menu drawer, the attendee and admin workspaces use a bottom navigation bar with a "More" drawer, deep pages carry breadcrumbs that collapse to a back control, and event pages pin a Register bar to the bottom of the screen. `src/styles/mobile.css` is loaded last and owns the small-screen rules. During development, `/?as=admin` or `/?as=attendee` opens a workspace directly (ignored in production builds), and in demo mode the sign-in page offers shortcuts into both workspaces.

Live payments: copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the running backend (default `http://localhost:8000`). Checkout then offers mobile money only and the payment page polls the server, which verifies each payment with Snippe before a ticket is issued. Leave the variable unset to keep the local demo checkout. The admin **All transactions** page needs the backend's `ADMIN_API_TOKEN`.

The backend will be added under `backend/` as a separately deployable FastAPI application while remaining in this monorepo. Production work should move toward the explicit domain/feature/service boundaries described in `docs/SYSTEM_ENGINEERING.md` rather than concentrating business logic in the current frontend prototype model.

## Pull requests

A PR template is available under `.github/pull_request_template.md`. PRs should document scope, implementation decisions, validation performed, security/data impact and known follow-up work.
