# AGENTS.md — NeuroTech Events

This file defines the working contract for AI coding agents and human contributors operating in this repository.

## 1. Project mission

NeuroTech Events is the frontend for an event-management platform serving three product surfaces:

- **Public:** event discovery, event detail, speakers, schedules, registration, checkout, payment status, and receipts.
- **Attendee:** dashboard, ticket, personal schedule, networking, notifications, and certificates.
- **Admin:** event management, ticket configuration, attendee management, check-in, schedule/timeline management, marketing, sponsors, payments, and reporting.

The current repository is a React + TypeScript + Vite frontend prototype. The existing UI is driven primarily by `src/lib/useAppModel.ts` and rendered from design data in `src/design/blocks.json` through `src/lib/dcRender.tsx`.

## 2. Non-negotiable Git workflow

1. **Never implement directly on `main`.**
2. All implementation work must be done on **`masterchanges`** unless the maintainer explicitly requests another branch.
3. Sync `masterchanges` with `main` before starting a new unit of work when required.
4. Make **small, focused commits**. One commit should represent one understandable change.
5. Use imperative, scoped commit messages, for example:
   - `docs: define frontend architecture`
   - `feat: add attendee ticket service`
   - `fix: preserve selected schedule day`
   - `refactor: extract event model types`
6. Do not mix unrelated refactors, features, formatting, and fixes in the same commit.
7. Before the final push/PR, run:

```bash
npm ci
npm run check
```

8. At the end of the requested implementation, open a PR from `masterchanges` into `main` with:
   - concise title;
   - summary of changes;
   - implementation notes;
   - testing performed;
   - risks / follow-up work.
9. Do not merge the PR unless explicitly instructed.
10. Do not force-push shared branches unless explicitly instructed.

See `docs/GIT_WORKFLOW.md` for the complete workflow.

## 3. Engineering approach

### Preserve the current product surfaces

Any change must consider public, attendee, and admin behavior independently. Avoid implementing a feature only for one surface when the domain requires shared behavior.

### Separate UI, domain state, and integrations

The current code is compact and prototype-oriented. New production implementation should move toward these boundaries:

- `components/` — reusable presentational UI;
- `features/` — product workflows grouped by domain;
- `services/` — API/network integrations;
- `types/` or `domain/` — shared domain contracts;
- `lib/` — generic utilities and infrastructure helpers;
- `design/` — prototype/reference design assets, not production business logic.

Do not add new large business workflows directly into `App.tsx`.

### Treat prototype design files carefully

`src/design/*.html`, `blocks.json`, and `sections.json` are design/prototype artifacts. Do not rewrite or delete them casually. If production components replace a design-driven path, document the migration and keep behavior parity until the replacement is validated.

### No fabricated integrations

The current repository does not establish a production backend contract. Do not invent live payment, authentication, ticketing, email, QR, or analytics endpoints. Define interfaces/contracts first and clearly mark mocked implementations.

### Security baseline

- Never commit secrets, API keys, tokens, passwords, private certificates, or `.env` values.
- Only expose browser-safe environment values with the expected Vite prefix.
- Validate and sanitize external URLs and untrusted input.
- Do not store sensitive payment information in the browser.
- Authentication/authorization enforcement must ultimately happen server-side, not only in UI guards.
- Preserve the safe URL handling already present in `dcRender.tsx` when modifying renderer behavior.

## 4. Required implementation sequence

For meaningful features, follow this sequence:

1. Read the relevant source and documentation.
2. Define the user flow and acceptance criteria.
3. Identify affected domain contracts and system boundaries.
4. Implement the smallest coherent change.
5. Add/update tests when test infrastructure exists; otherwise document the verification gap.
6. Run lint/type/build checks.
7. Commit the change independently.
8. Repeat until the requested scope is complete.
9. Update documentation if architecture, workflow, dependencies, or behavior changed.
10. Open the PR.

## 5. Definition of done

A task is complete when:

- requested behavior is implemented;
- TypeScript builds successfully;
- lint/check commands pass;
- no credentials or sensitive information are committed;
- UI changes remain usable across relevant viewport sizes;
- accessibility basics are preserved (keyboard navigation, labels, focus, semantic elements, alt text);
- changed architecture/behavior is documented;
- commits are small and comprehensible;
- a PR from `masterchanges` to `main` is opened.

## 6. Project-specific priorities

When evolving the prototype toward production, prioritize:

1. explicit domain types for events, sessions, tickets, attendees, registrations, payments, sponsors, and certificates;
2. routing and persistent navigation state;
3. API/service boundaries instead of hard-coded domain data;
4. authentication and role/permission design;
5. registration + ticketing workflow;
6. payment-provider integration through a backend;
7. QR/check-in workflow;
8. admin CRUD workflows;
9. observability, error states, loading states, and analytics;
10. automated test coverage and CI.

See `docs/IMPLEMENTATION_PLAN.md` and `docs/SYSTEM_ENGINEERING.md` before introducing major infrastructure.
