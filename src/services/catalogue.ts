/** Build the payload that publishes the admin console's catalogue to the payments server. */
import type { PlatformDatabase } from "../domain/types";

export function buildCataloguePayload(db: PlatformDatabase) {
  const venues = new Map(db.venues.map((venue) => [venue.id, venue]));
  return {
    vat_percent: db.settings.vatPercent,
    events: db.events.map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      subtitle: event.subtitle || null,
      description: event.description || null,
      theme: event.theme || null,
      category: event.category || null,
      status: event.status,
      format: event.format,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      capacity: event.capacity,
      registration_opens_at: event.registrationOpensAt || null,
      registration_closes_at: event.registrationClosesAt || null,
      featured: event.featured,
      banner_label: event.bannerLabel || null,
      highlights: event.highlights,
      faqs: event.faqs,
      venue_name: venues.get(event.venueId)?.name ?? null,
      venue_city: venues.get(event.venueId)?.city ?? null,
    })),
    ticket_types: db.ticketTypes.map((ticket) => ({
      id: ticket.id,
      event_id: ticket.eventId,
      name: ticket.name,
      tier: ticket.tier,
      price: ticket.price,
      currency: ticket.currency,
      perks: ticket.perks || null,
      capacity: ticket.capacity,
      active: ticket.active,
    })),
  };
}

export const ADMIN_TOKEN_KEY = "neurotech.events.admin-token";

/** Token that can publish the catalogue: a platform-admin login, or the pasted ADMIN_API_TOKEN. */
export function readAdminCredential(authToken: string | null): string | null {
  if (authToken) return authToken;
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}
