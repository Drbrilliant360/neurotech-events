# Contributing to NeuroTech Events

Contributions should preserve the current product experience while moving the project toward a typed, testable, production-ready event platform.

## Before you start

Read:

- `AGENTS.md`
- `docs/GIT_WORKFLOW.md`
- `docs/SYSTEM_ENGINEERING.md`
- `docs/IMPLEMENTATION_PLAN.md`

## Local setup

```bash
npm ci
npm run dev
```

Validation:

```bash
npm run check
```

The current `check` script runs linting and a production build.

## Branching

Normal implementation work belongs on `masterchanges` unless the maintainer explicitly requests another branch.

Do not implement directly on `main`.

## Scope changes carefully

Before editing code, identify:

1. which product surface is affected: public, attendee, admin, or shared;
2. whether the source of truth is UI-local, domain state, or future server-owned state;
3. whether the change requires a new contract/type;
4. whether the current design-renderer path is being preserved or replaced;
5. what must be manually or automatically verified.

## Code expectations

### TypeScript

- Prefer explicit domain types over `any`.
- Do not duplicate domain shapes in multiple files.
- Narrow unknown data at boundaries.
- Keep provider-specific payloads separate from internal domain types.

### React

- Keep presentational components separate from data/integration concerns when practical.
- Do not add substantial new workflow logic directly to `App.tsx`.
- Keep local UI state local.
- Treat backend-owned values such as payment status, entitlement, permissions, and ticket availability as server-owned once an API exists.

### Styling and design

- Preserve existing visual consistency unless the task intentionally changes design.
- Test changed layouts at narrow and wide viewport sizes.
- Avoid one-off styling patterns when an existing project pattern works.
- Preserve accessibility: focus, keyboard behavior, labels, semantic structure, and alt text.

### Prototype assets

Files under `src/design/` are currently important to the prototype. Do not remove or bulk-rewrite them without an intentional migration plan and behavior comparison.

## External integrations

Do not invent production endpoints or credentials.

For authentication, payments, notifications, storage, analytics, or other providers:

1. define the project-facing interface;
2. document the external contract;
3. keep secrets server-side;
4. implement mock/local behavior if the live backend is unavailable;
5. add the real provider integration only after requirements are confirmed.

## Commits

Create small logical commits using conventional prefixes, for example:

```text
feat: add ticket domain model
fix: handle missing event slug
refactor: extract public navigation config
docs: document registration flow
```

Each commit should be understandable independently and should avoid unrelated formatting or refactors.

## Pull requests

Open changes from `masterchanges` to `main`.

A PR should explain:

- what changed;
- why it changed;
- how it was implemented;
- how it was tested;
- known limitations/follow-ups.

Visual changes should include screenshots or a concise description of the affected screens when practical.

## Definition of done

A contribution is ready for review when:

- requested scope is complete;
- `npm run check` passes;
- relevant flows were manually verified;
- no secrets are committed;
- docs were updated where architecture/workflow/contracts changed;
- commits are focused;
- the PR is opened but not merged unless explicitly requested.
