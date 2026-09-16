# Frontend Design System — Neurotech Events

This document defines the visual and interaction direction for presentation-ready and production frontend work.

## Brand intent

Neurotech Events should feel like a direct extension of Neurotech Africa: modern infrastructure, confident technology, practical African business relevance, and precise execution.

The interface should not resemble a generic event-template marketplace. Public pages should be editorial and spacious. Attendee pages should be calm and task-oriented. Admin pages should be operational and information-dense without becoming visually noisy.

## Foundations

### Core palette

Use semantic tokens instead of introducing isolated hex values in feature components.

```css
--nt-ink: #111510;
--nt-ink-soft: #1a2117;
--nt-paper: #f7f8ef;
--nt-surface: #ffffff;
--nt-surface-soft: #f0f3e7;
--nt-text: #151912;
--nt-muted: #69715e;
--nt-line: rgba(17, 21, 16, 0.1);
--nt-green: #8ad356;
--nt-green-strong: #55a83d;
--nt-green-soft: #e8f4dc;
--nt-warning: #a56b1d;
--nt-danger: #9a4438;
```

### Typography

- Display/headings: Manrope, heavy but not oversized by default.
- Interface/body: DM Sans.
- Use tighter tracking on large headings.
- Body copy should generally stay between 14px and 18px.
- Avoid text blocks wider than approximately 70 characters on editorial surfaces.

### Shape

- Small controls: 10–14px radius.
- Cards: 18–24px radius.
- High-emphasis panels: 24–32px radius.
- Pill controls are appropriate for filters and compact CTAs, not every component.

### Spacing

Use an 8px-oriented scale:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
```

Do not solve spacing problems with arbitrary per-component pixel values when a reusable class/token is appropriate.

## Public surface

### Home hero

The hero must communicate three things above the fold:
- this is Neurotech Africa;
- this is the home of its events;
- there is a clear next event/action.

Preferred composition:
- editorial headline and short proposition on the left;
- event preview/artwork on the right;
- one dominant action and one secondary action;
- compact trust/proof indicators below the primary copy.

### Event cards

Each event card should expose the decision information before the user opens it:
- date;
- title;
- venue/format;
- event status;
- price or free label when known;
- registration CTA/state.

Cards should have a strong visual hierarchy and not depend on decorative hover effects to communicate clickability.

### Past-event proof

Past events should build trust and continuity. Prefer:
- photography/artwork;
- concise outcome/proof statement;
- date and event name;
- optional attendee/speaker statistics only when sourced from actual data.

## Attendee surface

The attendee dashboard is not an analytics dashboard. Prioritize actions and time-sensitive information.

Hierarchy:
1. next event;
2. ticket/check-in readiness;
3. next saved session or action;
4. notices;
5. past events and retained value such as certificates.

Use dark panels sparingly for the highest-priority upcoming-event card. Most other content should remain on light surfaces for legibility.

## Admin surface

The admin dashboard should support operator decisions.

Recommended hierarchy:
- event context and lifecycle status;
- key operational metrics;
- alerts/incomplete setup;
- latest registrations;
- capacity and check-in progress;
- shortcuts to common actions.

Charts should be used only when the trend itself matters. A large chart should not replace a clearer number, progress bar, or table.

## Interaction standards

### Buttons

Primary:
- high contrast;
- one primary action per local context where possible.

Secondary:
- outlined or low-contrast surface;
- must remain visually subordinate.

Danger:
- destructive color only;
- require confirmation for irreversible production actions.

### Forms

Every field needs:
- visible label;
- useful input type;
- error text close to the field;
- disabled/submitting behavior;
- keyboard-visible focus state.

Do not use placeholder text as the only label.

### Navigation

- Public navigation should remain compact.
- Attendee/admin navigation should clearly indicate the current route.
- Mobile admin/attendee navigation may become horizontally scrollable or use a drawer later; critical actions must remain reachable without desktop-only assumptions.

## Accessibility

Minimum expectations:
- semantic heading order;
- visible `:focus-visible` state;
- 44px touch targets for primary mobile controls;
- sufficient contrast for text and status indicators;
- meaningful labels for icon-only controls;
- reduced-motion support;
- no information conveyed by color alone.

## Responsive behavior

### Mobile

- single-column hero/content flow;
- full-width primary CTAs where useful;
- cards should not force horizontal scrolling;
- tables may use controlled horizontal scrolling only when a card/list alternative would lose important structure;
- check-in workflows should be optimized for one-handed phone use.

### Tablet

- two-column card grids where content permits;
- attendee/admin surfaces should preserve clear information hierarchy before attempting desktop density.

### Desktop

- editorial public layouts can use asymmetric 55/45 or 60/40 compositions;
- admin panels may use 2–3 column layouts where they improve scanning.

## Component direction

Prefer reusable semantic building blocks:

```text
PageHeader
SectionHeader
EventCard
EventHero
StatCard
StatusPill
ProgressBar
EmptyState
InlineAlert
ActionCard
DataTable
Avatar
TicketCard
```

Feature components should compose these rather than repeatedly defining presentation with large inline style objects.

## Motion

Motion should clarify hierarchy, not advertise the framework.

Good uses:
- subtle page/section entrance;
- hover elevation for obviously interactive cards;
- progress/state transitions;
- dialog opening/closing.

Avoid:
- constant ambient animation;
- large parallax effects;
- animations that delay access to content.

## Content rules

- Prefer “Neurotech” / “Neurotech Africa” consistently; avoid switching between unrelated conference brands.
- Avoid presenting invented attendance, revenue, speaker or partner numbers as factual production data.
- Demo metrics must be clearly sourced from demo data or labeled as prototype content.
- Dates, venues and pricing shown from application data should be treated as the source of truth inside the prototype.
