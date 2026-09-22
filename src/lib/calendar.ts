import { downloadTextFile } from "./csv";

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
}

export interface CalendarEntry {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  startsAt: string;
  endsAt: string;
}

/** Build a standards-compliant single-event iCalendar file. */
export function buildIcs(entry: CalendarEntry): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neurotech Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${entry.uid}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(entry.startsAt)}`,
    `DTEND:${icsDate(entry.endsAt)}`,
    `SUMMARY:${escapeIcs(entry.title)}`,
  ];
  if (entry.description) lines.push(`DESCRIPTION:${escapeIcs(entry.description)}`);
  if (entry.location) lines.push(`LOCATION:${escapeIcs(entry.location)}`);
  if (entry.url) lines.push(`URL:${entry.url}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, entry: CalendarEntry): void {
  downloadTextFile(filename.endsWith(".ics") ? filename : `${filename}.ics`, buildIcs(entry), "text/calendar;charset=utf-8");
}
