# ADR-0001: Frontend-only mock platform layer

- **Status:** Accepted
- **Date:** 2026-09-16
- **Owners:** NeuroTech Events frontend

## Context

The repository is a React prototype with no approved production backend, payment provider, or identity service. The product still needs a complete, demonstrable event platform across public, attendee, and admin surfaces.

## Decision

Keep the application **frontend only**. Domain types, repository interfaces, and a local/mock implementation persist demo state in `localStorage`. A labelled demo role switcher (visitor / attendee / admin) is stored in `sessionStorage` and is **not** production authentication.

The design-block renderer (`src/lib/dcRender.tsx`, `src/design/`) remains as a prototype reference. Interactive product flows are implemented as explicit React features.

## Alternatives considered

### Option A — Introduce a real backend now

- Advantages: true persistence and authorization
- Disadvantages: contradicts the current repository constraint and invents unverified infrastructure
- Risks: secrets, payment truth, and fake security

### Option B — Frontend-only repositories with a replacement boundary

- Advantages: demonstrable product, typed contracts, later API swap
- Disadvantages: data is browser-local; roles are UX-only
- Risks: users may mistake demo identity for security

## Consequences

### Positive

- Full public, attendee, and admin journeys work without a server
- Persistence is centralized; UI does not call `localStorage` directly
- Backend replacement can target repository/service methods

### Negative / trade-offs

- Refresh persistence is per browser
- Admin routes are not a security boundary

### Operational impact

- deployment: static Vite SPA
- monitoring: none beyond browser
- security: no secrets; payment methods are simulated
- migration: replace `LocalPlatformRepository` with HTTP services

## Validation

`npm run check` and manual registration → checkout → ticket → admin mutation flows.

## Follow-up

- [ ] Replace mock repositories with a versioned API
- [ ] Move payment truth and check-in validation to a server
- [ ] Replace the demo role switcher with real sessions
