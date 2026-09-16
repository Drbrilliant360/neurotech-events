# NeuroTech Events

Frontend prototype for the NeuroTech Events platform: a React + TypeScript event experience covering the public event website, attendee portal, and event administration workflows.

## Product surfaces

### Public

- event discovery and event details;
- speakers and schedule;
- registration;
- checkout and payment-status UX;
- receipt flow.

### Attendee

- dashboard;
- ticket;
- personal schedule;
- networking;
- notifications;
- certificates.

### Admin

- event creation and management;
- ticket configuration;
- attendees and check-in;
- schedule/timeline management;
- poster/communications/sponsors;
- payments and reports.

## Current architecture

The current repository is a React 19 + TypeScript + Vite SPA.

Interactive product flows live under `src/features/`, with typed domain models in `src/domain/`, a local repository in `src/repositories/`, and React Router routes in `src/app/`. Demo data is seeded on first visit and persisted through repositories to `localStorage`. The prototype design renderer (`src/lib/dcRender.tsx`, `src/design/`) is retained as a visual reference.

This application is **frontend only**. There is no backend, database, live payment provider, or production authentication. The Public / Attendee / Admin control is a demo identity switcher.

Reset demo data from the top bar.

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

## Engineering documentation

Read these before major implementation work:

- [`AGENTS.md`](./AGENTS.md) — rules for AI agents and contributors, including the required branch/commit/PR workflow.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution and implementation expectations.
- [`docs/GIT_WORKFLOW.md`](./docs/GIT_WORKFLOW.md) — branch, commit, validation, and PR process.
- [`docs/SYSTEM_ENGINEERING.md`](./docs/SYSTEM_ENGINEERING.md) — current system baseline, target boundaries, security, reliability, payments, check-in, and observability.
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — phased roadmap from prototype to production.
- [`docs/adr/0000-template.md`](./docs/adr/0000-template.md) — architecture decision record template.
- [`SECURITY.md`](./SECURITY.md) — project security policy and security-sensitive implementation guidance.

## Source layout

```text
src/
  app/          Router, layouts, demo identity provider
  components/   Shared presentational widgets
  domain/       Typed event-platform contracts
  data/seed/    Deterministic mock dataset
  features/     Public, attendee, and admin screens
  repositories/ Local persistence implementations
  lib/          Formatters, CSV, storage helper, prototype renderer
  design/       Prototype/design source artifacts
  App.tsx       Application shell
```

As the application evolves, new production work should move toward explicit domain/feature/service boundaries described in `docs/SYSTEM_ENGINEERING.md` rather than concentrating additional business logic in the current prototype model.

## Pull requests

A PR template is available under `.github/pull_request_template.md`. PRs should document scope, implementation decisions, validation performed, security/data impact, and known follow-up work.
