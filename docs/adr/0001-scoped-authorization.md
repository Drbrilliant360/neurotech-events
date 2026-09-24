# ADR 0001: Scoped authorization for organizations and events

- Status: Accepted
- Date: 2026-09-24

## Context

Neurotech Events has platform-level user roles, but event administration must support
multiple organizations and different responsibilities within one event. A global
`event_admin` flag cannot safely express ownership, finance access, event management,
check-in, or speaker assignments.

## Decision

Keep `User.role` for platform-wide identity and compatibility, and model operational
permissions with two scoped relationships:

- `OrganizationMembership` assigns `owner`, `admin`, `finance`, or `member` within an
  organization.
- `EventStaffAssignment` assigns `manager`, `staff`, `check_in`, or `speaker` within
  an event.

The authorization service calculates effective access server-side. Platform
administrators retain cross-organization access. Organization owners/admins can
manage their organization events, finance members can access finance operations, and
event assignments grant only the event capabilities represented by their role.

HTTP dependencies must return `401` for missing/invalid authentication, `403` for an
authenticated user without the required scope, and `404` for missing resources.
Frontend role checks are informative only and never authoritative.

## Consequences

- New administrative routes must use scoped authorization rather than trusting a
  client-supplied role.
- Membership and assignment changes are persisted and can be audited later.
- Existing static admin-token routes remain as a break-glass compatibility path until
  each route is migrated to scoped checks.
- Role changes require database migrations and updates to the Postman contract.
