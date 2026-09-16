# Product Requirements — Neurotech Events

## 1. Product vision

Neurotech Events is the event experience for Neurotech Africa. It should provide one consistent place where people discover Neurotech events, register, manage attendance, revisit their event history, and receive post-event value. Internally, it should give the Neurotech team a dependable operational workspace for publishing events, managing attendees, check-in, communications, payments, and reporting.

The product should feel like part of Neurotech Africa rather than a standalone conference microsite. The public experience must therefore support multiple event formats over time: summits, workshops, product launches, partner sessions, community meetups, exhibitions, webinars, and invite-only events.

## 2. Primary users

### Visitor

A person who has not signed in.

Goals:
- understand what Neurotech Events is;
- discover upcoming events;
- view event details, venue, agenda and speakers;
- register with minimal friction;
- understand whether an event is free, paid, public or invite-only.

### Attendee

A registered user with a persistent account.

Goals:
- see upcoming registrations;
- access tickets and check-in information;
- save sessions;
- receive notices;
- see previously attended Neurotech events;
- download certificates or receipts when available;
- manage profile and communication preferences.

### Administrator

A Neurotech team member with elevated permissions.

Goals:
- create, edit, publish, unpublish and archive events;
- manage ticket types and capacity;
- manage attendee records and registrations;
- perform check-in and undo incorrect check-ins;
- publish schedules, speakers and sponsors;
- issue event communications;
- inspect payments and operational reports;
- configure event-level settings without modifying source code.

## 3. Core public experience

### Home

The home page should prioritize:
1. the next important Neurotech event;
2. a concise explanation of the Neurotech Events proposition;
3. upcoming events;
4. event formats/topics;
5. evidence from previous events;
6. a clear path to registration or account access.

The home page must not be permanently tied to one summit. Content should remain useful even when the featured event changes.

### Events index

Requirements:
- upcoming and past event separation;
- search and topic filtering;
- event cards with date, location/format, status and registration state;
- clear handling for sold-out, registration-closed and invite-only events.

### Event detail

Minimum information:
- title and concise event proposition;
- date/time and timezone;
- venue or online format;
- registration state;
- agenda/schedule;
- speakers;
- ticket options where applicable;
- sponsors/partners where applicable;
- event-specific FAQs and contact path.

## 4. Account and attendee experience

Authentication is a production concern and is not implemented by the current frontend prototype. The UI architecture should nevertheless model a persistent account experience rather than a temporary registration form.

### Attendee dashboard

The dashboard should answer four questions immediately:
- What is my next Neurotech event?
- What do I need to do before I attend?
- What is happening next during the event?
- What have I attended before?

Required modules:
- next registered event;
- ticket/check-in status;
- saved or next session;
- notices;
- event history;
- certificates/receipts;
- profile completion and preferences.

### Event history

Each attendee should be able to see past registrations and attendance. The future backend should distinguish:
- registered;
- paid, if applicable;
- checked in;
- attended/eligible for certificate;
- cancelled/no-show.

This history becomes a reusable relationship layer between Neurotech Africa and its event community.

## 5. Administration experience

The admin application should use role-aware permissions and explicit event lifecycle states.

### Event lifecycle

Recommended states:
- `draft` — editable and invisible publicly;
- `published` — publicly visible;
- `registration_closed` — visible but no new registrations;
- `completed` — event has ended and appears in history/archive;
- `cancelled` — visible with cancellation messaging where appropriate;
- `archived` — retained operationally but removed from normal public discovery.

The current frontend domain contracts may use fewer states. Expanding the production model requires an ADR and migration plan.

### Admin dashboard

The dashboard should emphasize operations, not decorative analytics. Minimum useful information:
- next/live event status;
- registrations versus capacity;
- checked-in count;
- payment/revenue state for paid events;
- latest registrations;
- operational alerts such as low capacity, unpublished schedule, failed payment or incomplete event configuration;
- shortcuts to the event actions most likely needed today.

### Event management

Administrators should be able to configure:
- event identity and slug;
- event artwork/media;
- date/time/timezone;
- venue or online access;
- registration window;
- capacity;
- ticket types;
- agenda/sessions;
- speakers;
- sponsors/partners;
- communications;
- certificate eligibility;
- publishing state.

## 6. Product rules

- Event publishing and registration state must never be inferred only from dates in the UI. The backend must expose explicit state.
- Registration, payment and check-in operations must be idempotent.
- Capacity must be enforced server-side in production.
- Administrative changes affecting money, attendee identity, check-in or publishing should be auditable.
- Public pages must remain useful without authentication.
- Attendee-only information must never be exposed through public event endpoints.
- Admin authorization must be enforced by the backend, not only hidden in navigation.
- Event dates must be timezone-aware.
- The product must remain usable on mobile because registration and check-in are likely to happen on phones.

## 7. Recommended production information architecture

```text
Public
  /
  /events
  /events/:slug
  /speakers
  /schedule
  /register/:event

Attendee
  /app
  /app/events
  /app/history
  /app/ticket
  /app/schedule
  /app/notifications
  /app/certificates
  /app/profile

Admin
  /admin
  /admin/events
  /admin/events/new
  /admin/events/:id
  /admin/attendees
  /admin/check-in
  /admin/schedule
  /admin/communications
  /admin/payments
  /admin/reports
  /admin/settings
```

The present route set can evolve toward this model incrementally; a disruptive route rewrite is not required for the prototype.

## 8. Design direction

The visual language should inherit from Neurotech Africa: strong editorial typography, dark infrastructure-oriented surfaces, high-contrast green accents, restrained gradients, generous spacing, and minimal visual noise.

Use the design to communicate:
- credible technology company;
- African market relevance;
- high-quality event execution;
- accessible, practical participation.

Avoid:
- generic conference-template aesthetics;
- excessive neon/AI visual clichés;
- large amounts of decorative glassmorphism;
- dense dashboards with metrics that do not support an operator decision;
- placeholder content presented as production fact.

## 9. Delivery phases

### Phase 1 — Presentation-ready frontend

- refine public home and event discovery;
- refine attendee dashboard and event-history concept;
- refine admin dashboard and operational hierarchy;
- establish reusable design tokens/components;
- retain deterministic local demo data.

### Phase 2 — Production foundation

- production authentication and RBAC;
- backend/API and database;
- media storage;
- admin event CRUD;
- attendee account persistence;
- registration and capacity enforcement;
- audit logging and observability.

### Phase 3 — Operational integrations

- payment provider integration where events are paid;
- email/SMS/WhatsApp transactional communication;
- QR ticket validation and check-in;
- certificate issuance and verification;
- analytics/reporting pipeline.

## 10. Definition of done for production features

A production feature is not done until:
- UX works across mobile and desktop;
- loading, empty, error and permission states are defined;
- domain and API contracts are typed;
- security/data impact is reviewed;
- automated tests cover critical business behavior;
- lint, typecheck and build pass;
- observability is defined for failure-prone operations;
- documentation is updated when architecture or workflow changes.
