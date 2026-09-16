export function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const dayOnly = new Intl.DateTimeFormat("en-GB", { day: "2-digit" });
  const monthYear = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
  if (sameDay) return dayFmt.format(start);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${dayOnly.format(start)}–${dayFmt.format(end)}`;
  }
  return `${dayFmt.format(start)} – ${monthYear.format(end)}`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function minutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function sessionsOverlap(
  a: { dayIndex: number; startTime: string; endTime: string },
  b: { dayIndex: number; startTime: string; endTime: string },
): boolean {
  if (a.dayIndex !== b.dayIndex) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}
