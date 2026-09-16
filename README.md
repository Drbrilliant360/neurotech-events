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

The current repository is a frontend prototype built with:

- React 19;
- TypeScript;
- Vite;
- Framer Motion;
- Oxlint.

The current UI is largely driven by `src/lib/useAppModel.ts`, with design blocks from `src/design/blocks.json` rendered through `src/lib/dcRender.tsx`.

This repository does not currently define a production backend, database, authentication provider, payment gateway, or notification provider. Those integrations should be introduced behind explicit interfaces and documented system boundaries.

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
  design/       Prototype/design source artifacts
  lib/          Current renderer and application model
  App.tsx       Application shell
  App.css       Application styling
  main.tsx      React entry point
```

As the application evolves, new production work should move toward explicit domain/feature/service boundaries described in `docs/SYSTEM_ENGINEERING.md` rather than concentrating additional business logic in the current prototype model.

## Pull requests

A PR template is available under `.github/pull_request_template.md`. PRs should document scope, implementation decisions, validation performed, security/data impact, and known follow-up work.
