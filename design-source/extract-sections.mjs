#!/usr/bin/env node
/**
 * Extract major screen sections from the Claude Design decoded HTML
 * into sections.json, and write structure-notes.md for React conversion.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, 'NeuroTech-decoded.html');
const SCRIPT_PATH = join(__dirname, 'script-0.js');
const OUT_JSON = join(__dirname, 'sections.json');
const OUT_NOTES = join(__dirname, 'structure-notes.md');

/** Map `is.*` camelCase flags → screenId keys used by the prototype. */
const IS_KEY_TO_SCREEN = {
  home: 'home',
  events: 'events',
  event: 'event',
  speakers: 'speakers',
  schedule: 'schedule',
  register: 'register',
  checkout: 'checkout',
  payment: 'payment',
  receipt: 'receipt',
  user: 'user',
  admin: 'admin',
  uDash: 'u-dash',
  uTicket: 'u-ticket',
  uSchedule: 'u-schedule',
  uNetwork: 'u-network',
  uNotify: 'u-notify',
  uCert: 'u-cert',
  aDash: 'a-dash',
  aEvents: 'a-events',
  aCreate: 'a-create',
  aTickets: 'a-tickets',
  aAttendees: 'a-attendees',
  aCheckin: 'a-checkin',
  aSchedule: 'a-schedule',
  aTimeline: 'a-timeline',
  aPoster: 'a-poster',
  aComms: 'a-comms',
  aSponsors: 'a-sponsors',
  aPayments: 'a-payments',
  aReports: 'a-reports',
};

const PRIMARY_SCREENS = [
  'home', 'events', 'event', 'speakers', 'schedule',
  'register', 'checkout', 'payment', 'receipt',
  'user', 'admin',
];

/**
 * Find a balanced <sc-if>...</sc-if> starting at `openTagStart`.
 * Returns { start, end, openEnd, closeStart } or null.
 */
function findBalancedScIf(html, openTagStart) {
  const openRe = /<sc-if\b[^>]*>/gi;
  const closeRe = /<\/sc-if>/gi;
  openRe.lastIndex = openTagStart;
  const openMatch = openRe.exec(html);
  if (!openMatch || openMatch.index !== openTagStart) return null;

  let depth = 1;
  let pos = openMatch.index + openMatch[0].length;
  const openEnd = pos;

  while (depth > 0 && pos < html.length) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) return null;

    const openIdx = nextOpen ? nextOpen.index : Infinity;
    const closeIdx = nextClose.index;

    if (openIdx < closeIdx) {
      depth += 1;
      pos = openIdx + nextOpen[0].length;
    } else {
      depth -= 1;
      if (depth === 0) {
        return {
          start: openTagStart,
          end: closeIdx + nextClose[0].length,
          openEnd,
          closeStart: closeIdx,
        };
      }
      pos = closeIdx + nextClose[0].length;
    }
  }
  return null;
}

/**
 * Extract inner HTML for each `is.*` sc-if whose key is in IS_KEY_TO_SCREEN.
 * Nested sc-ifs are extracted independently (user/admin shells + leaf screens).
 */
function extractSections(html) {
  const sections = {};
  const meta = {};
  const openPattern = /<sc-if\b[^>]*\bvalue="\{\{\s*is\.([a-zA-Z0-9_]+)\s*\}\}"[^>]*>/gi;

  let match;
  while ((match = openPattern.exec(html)) !== null) {
    const isKey = match[1];
    const screenId = IS_KEY_TO_SCREEN[isKey];
    if (!screenId) continue;

    const range = findBalancedScIf(html, match.index);
    if (!range) {
      console.warn(`Unbalanced sc-if for is.${isKey}`);
      continue;
    }

    const inner = html.slice(range.openEnd, range.closeStart).replace(/^\n/, '').replace(/\n$/, '');
    sections[screenId] = inner;
    meta[screenId] = {
      isKey,
      startIndex: range.start,
      endIndex: range.end,
      charCount: inner.length,
      lineApprox: html.slice(0, range.start).split('\n').length,
    };

    // Continue scanning after this open tag so nested sc-ifs are also found
    openPattern.lastIndex = match.index + match[0].length;
  }

  return { sections, meta };
}

/** Collect unique hex / rgba color tokens from a string. */
function collectColors(text) {
  const hex = [...text.matchAll(/#(?:[0-9a-fA-F]{3,8})\b/g)].map((m) => m[0].toLowerCase());
  const rgba = [...text.matchAll(/rgba?\([^)]+\)/g)].map((m) => m[0]);
  return {
    hex: [...new Set(hex)].sort(),
    rgba: [...new Set(rgba)].sort(),
  };
}

function collectFonts(text) {
  const families = [...text.matchAll(/['"]((?:Manrope|DM Sans)[^'"]*)['"]/g)].map((m) => m[1]);
  const fontShorthands = [...text.matchAll(/font:\s*([^;]+)/g)].map((m) => m[1].trim());
  return {
    families: [...new Set(families)],
    sampleShorthands: [...new Set(fontShorthands)].slice(0, 24),
  };
}

function collectRadii(text) {
  const radii = [...text.matchAll(/border-radius:\s*([^;]+)/g)].map((m) => m[1].trim());
  return [...new Set(radii)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function buildStructureNotes({ sections, meta, html, script }) {
  const colors = collectColors(html + '\n' + script);
  const fonts = collectFonts(html);
  const radii = collectRadii(html);

  const publicScreens = PRIMARY_SCREENS.filter((id) => id !== 'user' && id !== 'admin');
  const userScreens = Object.keys(sections).filter((id) => id.startsWith('u-')).sort();
  const adminScreens = Object.keys(sections).filter((id) => id.startsWith('a-')).sort();

  const lines = [];
  lines.push('# NeuroTech Summit — Structure Notes');
  lines.push('');
  lines.push('Notes derived from `NeuroTech-decoded.html` and `script-0.js` for React conversion.');
  lines.push('');

  lines.push('## Screen inventory');
  lines.push('');
  lines.push(`- **Public screens (${publicScreens.length}):** ${publicScreens.join(', ')}`);
  lines.push(`- **Group shells (2):** user, admin`);
  lines.push(`- **Attendee screens (${userScreens.length}):** ${userScreens.join(', ')}`);
  lines.push(`- **Admin screens (${adminScreens.length}):** ${adminScreens.join(', ')}`);
  lines.push(`- **Total extracted section keys:** ${Object.keys(sections).length}`);
  lines.push('');
  lines.push('| screenId | is.* flag | ~line | chars |');
  lines.push('|---|---|---:|---:|');
  for (const id of Object.keys(meta).sort((a, b) => meta[a].lineApprox - meta[b].lineApprox)) {
    const m = meta[id];
    lines.push(`| \`${id}\` | \`is.${m.isKey}\` | ${m.lineApprox} | ${m.charCount} |`);
  }
  lines.push('');

  lines.push('## Layout patterns');
  lines.push('');
  lines.push('### App shell');
  lines.push('- Root: full-viewport soft green→cream diagonal gradient (`#e4eed0 → #eef2dc → #fbf8e3`), body text `#12150c`, `DM Sans`.');
  lines.push('- Optional prototype chrome (`showNav`): sticky blurred bar with **group tabs** (Public / Attendee / Admin) + **screen chips**.');
  lines.push('- Content max width **1320px**, horizontal padding **24px**.');
  lines.push('');
  lines.push('### Public site');
  lines.push('- Top site header: logo mark + “NeuroTech Summit”, pill `siteNav`, Login text + dark “Get Started” CTA.');
  lines.push('- Screens are mutually exclusive `sc-if` siblings under `is.public`.');
  lines.push('- Home: two-column hero (`auto-fit` / `minmax(420px,1fr)`), optional collage (`showCollage`), then stacked marketing sections (why attend, speakers, sponsors, footer).');
  lines.push('- Listing screens (events / speakers): page title + filter chips + responsive card grids.');
  lines.push('- Event detail: hero media + meta + CTA, then highlights / FAQ / related content.');
  lines.push('- Schedule: day tabs driven by `state.day` → `dayItems`.');
  lines.push('- Register: 5-step wizard (`state.step` 1–5) with `wz.s1`…`wz.s5` panels.');
  lines.push('- Checkout / payment / receipt: centered commerce flow; payment has processing/success/failed states via `payStatus`.');
  lines.push('');
  lines.push('### Attendee (`user`)');
  lines.push('- Two-column shell: **268px** light sidebar (`#fbfaf0`) + main (`clamp` padding).');
  lines.push('- Sidebar: brand, `userNav` list, profile footer.');
  lines.push('- Nested screens: dashboard stats, ticket, personal schedule, networking grid, notifications, certificates.');
  lines.push('');
  lines.push('### Admin (`admin`)');
  lines.push('- Two-column shell: **262px** dark sidebar (`#111510`) + light gradient main.');
  lines.push('- Sidebar: grouped nav (`adminNav` sections with title + items).');
  lines.push('- Nested screens: ops dashboards, CRUD-ish builders, tables, check-in, poster designer, comms, sponsors, reports.');
  lines.push('');
  lines.push('### Recurring UI primitives (inline styles)');
  lines.push('- **Pills / chips:** `border-radius: 999px` for nav, filters, CTAs.');
  lines.push('- **Cards / panels:** white fill, `1px solid rgba(18,21,12,.08)`, radius **14–22px**.');
  lines.push('- **Stat tiles:** compact white cards with Manrope numerals.');
  lines.push('- **Primary CTA:** `#111510` fill, white text, pill; hover often `#2f8f3c` (`style-hover`).');
  lines.push('- **Secondary CTA:** white / transparent + soft border.');
  lines.push('- **Status chips:** tinted bg (`#eaf3e0`, `#f6f0dc`, `#f6e5e0`) + matching text color.');
  lines.push('- **Logo mark:** 30–38px square, radius 9–12px, gradient `#8ad356 → #2f8f3c`.');
  lines.push('- **Media:** custom `<image-slot>` with `id`, `src`, `shape`, `radius`, `placeholder`.');
  lines.push('');

  lines.push('## CSS tokens');
  lines.push('');
  lines.push('### Colors (canonical)');
  lines.push('| Token role | Value |');
  lines.push('|---|---|');
  lines.push('| Page wash / body bg | `#f4f5e2` |');
  lines.push('| App gradient stops | `#e4eed0`, `#eef2dc`, `#fbf8e3`, `#eaf0da` |');
  lines.push('| Ink / primary text | `#12150c` |');
  lines.push('| Muted text | `#5b6349`, `#7c8467`, `#9aa287`, `#6b7358`, `#454d38` |');
  lines.push('| Accent (prop default) | `#8ad356` (`accentColor`) |');
  lines.push('| Accent options | `#5fc16a`, `#c9de4a`, `#2f8f3c` |');
  lines.push('| Link / success green | `#2f7d34` |');
  lines.push('| Primary surface (dark) | `#111510` |');
  lines.push('| Cream surfaces | `#fbfaf0`, `#fff`, `#f4f8ea`, `#eef1e1`, `#e4ebd4` |');
  lines.push('| Warning / pending | `#8a6b1f`, `#c9a227`, chip `#f6f0dc` |');
  lines.push('| Danger / refund | `#8a3b2f`, chip `#f6e5e0` |');
  lines.push('| Admin nav muted | `#a7b28d`, active tint `rgba(138,211,86,.16)` / `#c9e8a6` |');
  lines.push('');
  lines.push(`### Hex colors observed (${colors.hex.length})`);
  lines.push('');
  lines.push('```');
  lines.push(colors.hex.join(', '));
  lines.push('```');
  lines.push('');
  lines.push('### Typography');
  lines.push('- **Display / brand:** Manrope (weights 500–800), tight tracking (`-.02em` to `-.035em`).');
  lines.push('- **UI / body:** DM Sans (400–700), opsz variable font.');
  lines.push('- Headlines: `clamp(...)` responsive Manrope; body ~15–18px DM Sans.');
  lines.push('- Google Fonts import in `<helmet>`.');
  lines.push('');
  lines.push('### Radii');
  lines.push('');
  lines.push('```');
  lines.push(radii.join(', '));
  lines.push('```');
  lines.push('');
  lines.push('Common: `999px` (pills), `50%` (avatars/dots), `9–12px` (logo/nav items), `14–22px` (cards).');
  lines.push('');

  lines.push('## Interaction model');
  lines.push('');
  lines.push('### Routing');
  lines.push('- Single component state: `screen` (string id). Getter falls back to `props.startScreen` or `"home".');
  lines.push('- `set(screen)` / `go(id)` handlers wire all nav buttons via `onClick="{{ ... }}"`.');
  lines.push('- Group derived from screen prefix: `u-*` → user, `a-*` → admin, else public.');
  lines.push('- Boolean map `is.*` drives every `sc-if` (including nested wizard / payment status flags).');
  lines.push('');
  lines.push('### Local UI state');
  lines.push('| Key | Purpose |');
  lines.push('|---|---|');
  lines.push('| `step` | Registration wizard 1–5 |');
  lines.push('| `ticket` | Selected ticket tier name |');
  lines.push('| `day` | Schedule day index |');
  lines.push('| `payMethod` | Checkout method id |');
  lines.push('| `payStatus` | `processing` \\| `success` \\| `failed` |');
  lines.push('');
  lines.push('### Template DSL → React mapping');
  lines.push('- `<sc-if value="{{ expr }}">` → conditional render (`{cond && ...}` / routes).');
  lines.push('- `<sc-for list="{{ arr }}" as="item">` → `.map`.');
  lines.push('- `{{ path }}` interpolations → JSX expressions.');
  lines.push('- `onClick="{{ handler }}"` → React `onClick`.');
  lines.push('- `style-hover="..."` → CSS `:hover` or styled-components / CSS modules.');
  lines.push('- `<image-slot>` → replace with `<img>` / Next `Image` + placeholder.');
  lines.push('- Props: `showPrototypeNav`, `startScreen`, `showHeroCollage`, `accentColor`.');
  lines.push('');
  lines.push('### Suggested React route map');
  lines.push('```');
  lines.push('Public:  /  /events  /events/:id  /speakers  /schedule');
  lines.push('         /register  /checkout  /payment  /receipt');
  lines.push('User:    /app  /app/ticket  /app/schedule  /app/network  /app/notifications  /app/certificates');
  lines.push('Admin:   /admin  /admin/events  /admin/events/new  /admin/tickets');
  lines.push('         /admin/attendees  /admin/check-in  /admin/schedule  /admin/timeline');
  lines.push('         /admin/poster  /admin/comms  /admin/sponsors  /admin/payments  /admin/reports');
  lines.push('```');
  lines.push('');
  lines.push('## Extraction outputs');
  lines.push('');
  lines.push('- `sections.json` — `screenId →` raw inner HTML of each major `sc-if`.');
  lines.push('- Nested user/admin page sections are included alongside the `user` / `admin` shells.');
  lines.push('- Template bindings (`{{ ... }}`, `sc-for`, `sc-if`) are preserved for downstream conversion.');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const html = readFileSync(HTML_PATH, 'utf8');
  const script = readFileSync(SCRIPT_PATH, 'utf8');

  const { sections, meta } = extractSections(html);

  const missingPrimary = PRIMARY_SCREENS.filter((id) => !sections[id]);
  if (missingPrimary.length) {
    console.error('Missing primary screens:', missingPrimary.join(', '));
    process.exitCode = 1;
  }

  // Stable key order: primary first, then nested screens alphabetically
  const ordered = {};
  for (const id of PRIMARY_SCREENS) {
    if (sections[id]) ordered[id] = sections[id];
  }
  for (const id of Object.keys(sections).sort()) {
    if (!ordered[id]) ordered[id] = sections[id];
  }

  writeFileSync(OUT_JSON, JSON.stringify(ordered, null, 2) + '\n', 'utf8');

  const notes = buildStructureNotes({ sections: ordered, meta, html, script });
  writeFileSync(OUT_NOTES, notes, 'utf8');

  const publicCount = PRIMARY_SCREENS.filter((id) => id !== 'user' && id !== 'admin' && ordered[id]).length;
  const userNested = Object.keys(ordered).filter((id) => id.startsWith('u-')).length;
  const adminNested = Object.keys(ordered).filter((id) => id.startsWith('a-')).length;
  const colors = collectColors(html);
  const radii = collectRadii(html);

  console.log('Wrote', OUT_JSON);
  console.log('Wrote', OUT_NOTES);
  console.log('');
  console.log('Screen counts:');
  console.log(`  public: ${publicCount}`);
  console.log(`  shells: user=${Boolean(ordered.user)} admin=${Boolean(ordered.admin)}`);
  console.log(`  user nested: ${userNested}`);
  console.log(`  admin nested: ${adminNested}`);
  console.log(`  total keys: ${Object.keys(ordered).length}`);
  console.log('');
  console.log('Design tokens:');
  console.log(`  hex colors: ${colors.hex.length}`);
  console.log(`  radii variants: ${radii.length}`);
  console.log(`  fonts: Manrope, DM Sans`);
  console.log(`  accent default: #8ad356`);
}

main();
