# NeuroTech Summit — Structure Notes

Notes derived from `NeuroTech-decoded.html` and `script-0.js` for React conversion.

## Screen inventory

- **Public screens (9):** home, events, event, speakers, schedule, register, checkout, payment, receipt
- **Group shells (2):** user, admin
- **Attendee screens (6):** u-cert, u-dash, u-network, u-notify, u-schedule, u-ticket
- **Admin screens (13):** a-attendees, a-checkin, a-comms, a-create, a-dash, a-events, a-payments, a-poster, a-reports, a-schedule, a-sponsors, a-tickets, a-timeline
- **Total extracted section keys:** 30

| screenId | is.* flag | ~line | chars |
|---|---|---:|---:|
| `home` | `is.home` | 70 | 10394 |
| `events` | `is.events` | 198 | 2302 |
| `event` | `is.event` | 229 | 6897 |
| `speakers` | `is.speakers` | 310 | 1840 |
| `schedule` | `is.schedule` | 336 | 1466 |
| `register` | `is.register` | 358 | 6995 |
| `checkout` | `is.checkout` | 447 | 6703 |
| `payment` | `is.payment` | 516 | 4140 |
| `receipt` | `is.receipt` | 560 | 4067 |
| `user` | `is.user` | 632 | 12603 |
| `u-dash` | `is.uDash` | 654 | 2984 |
| `u-ticket` | `is.uTicket` | 687 | 2084 |
| `u-schedule` | `is.uSchedule` | 712 | 1464 |
| `u-network` | `is.uNetwork` | 733 | 1921 |
| `u-notify` | `is.uNotify` | 757 | 809 |
| `u-cert` | `is.uCert` | 772 | 1329 |
| `admin` | `is.admin` | 795 | 33466 |
| `a-dash` | `is.aDash` | 813 | 2965 |
| `a-events` | `is.aEvents` | 854 | 1724 |
| `a-create` | `is.aCreate` | 877 | 5218 |
| `a-tickets` | `is.aTickets` | 924 | 1961 |
| `a-attendees` | `is.aAttendees` | 949 | 2265 |
| `a-checkin` | `is.aCheckin` | 977 | 2725 |
| `a-payments` | `is.aPayments` | 1013 | 2036 |
| `a-schedule` | `is.aSchedule` | 1042 | 1870 |
| `a-timeline` | `is.aTimeline` | 1068 | 1666 |
| `a-poster` | `is.aPoster` | 1092 | 2266 |
| `a-comms` | `is.aComms` | 1120 | 2085 |
| `a-sponsors` | `is.aSponsors` | 1146 | 1436 |
| `a-reports` | `is.aReports` | 1165 | 2884 |

## Layout patterns

### App shell
- Root: full-viewport soft green→cream diagonal gradient (`#e4eed0 → #eef2dc → #fbf8e3`), body text `#12150c`, `DM Sans`.
- Optional prototype chrome (`showNav`): sticky blurred bar with **group tabs** (Public / Attendee / Admin) + **screen chips**.
- Content max width **1320px**, horizontal padding **24px**.

### Public site
- Top site header: logo mark + “NeuroTech Summit”, pill `siteNav`, Login text + dark “Get Started” CTA.
- Screens are mutually exclusive `sc-if` siblings under `is.public`.
- Home: two-column hero (`auto-fit` / `minmax(420px,1fr)`), optional collage (`showCollage`), then stacked marketing sections (why attend, speakers, sponsors, footer).
- Listing screens (events / speakers): page title + filter chips + responsive card grids.
- Event detail: hero media + meta + CTA, then highlights / FAQ / related content.
- Schedule: day tabs driven by `state.day` → `dayItems`.
- Register: 5-step wizard (`state.step` 1–5) with `wz.s1`…`wz.s5` panels.
- Checkout / payment / receipt: centered commerce flow; payment has processing/success/failed states via `payStatus`.

### Attendee (`user`)
- Two-column shell: **268px** light sidebar (`#fbfaf0`) + main (`clamp` padding).
- Sidebar: brand, `userNav` list, profile footer.
- Nested screens: dashboard stats, ticket, personal schedule, networking grid, notifications, certificates.

### Admin (`admin`)
- Two-column shell: **262px** dark sidebar (`#111510`) + light gradient main.
- Sidebar: grouped nav (`adminNav` sections with title + items).
- Nested screens: ops dashboards, CRUD-ish builders, tables, check-in, poster designer, comms, sponsors, reports.

### Recurring UI primitives (inline styles)
- **Pills / chips:** `border-radius: 999px` for nav, filters, CTAs.
- **Cards / panels:** white fill, `1px solid rgba(18,21,12,.08)`, radius **14–22px**.
- **Stat tiles:** compact white cards with Manrope numerals.
- **Primary CTA:** `#111510` fill, white text, pill; hover often `#2f8f3c` (`style-hover`).
- **Secondary CTA:** white / transparent + soft border.
- **Status chips:** tinted bg (`#eaf3e0`, `#f6f0dc`, `#f6e5e0`) + matching text color.
- **Logo mark:** 30–38px square, radius 9–12px, gradient `#8ad356 → #2f8f3c`.
- **Media:** custom `<image-slot>` with `id`, `src`, `shape`, `radius`, `placeholder`.

## CSS tokens

### Colors (canonical)
| Token role | Value |
|---|---|
| Page wash / body bg | `#f4f5e2` |
| App gradient stops | `#e4eed0`, `#eef2dc`, `#fbf8e3`, `#eaf0da` |
| Ink / primary text | `#12150c` |
| Muted text | `#5b6349`, `#7c8467`, `#9aa287`, `#6b7358`, `#454d38` |
| Accent (prop default) | `#8ad356` (`accentColor`) |
| Accent options | `#5fc16a`, `#c9de4a`, `#2f8f3c` |
| Link / success green | `#2f7d34` |
| Primary surface (dark) | `#111510` |
| Cream surfaces | `#fbfaf0`, `#fff`, `#f4f8ea`, `#eef1e1`, `#e4ebd4` |
| Warning / pending | `#8a6b1f`, `#c9a227`, chip `#f6f0dc` |
| Danger / refund | `#8a3b2f`, chip `#f6e5e0` |
| Admin nav muted | `#a7b28d`, active tint `rgba(138,211,86,.16)` / `#c9e8a6` |

### Hex colors observed (41)

```
#0d1a09, #111510, #12150c, #2f7d34, #2f8f3c, #37502b, #3b432c, #454d38, #5b6349, #5fc16a, #6b7358, #79855f, #7c8467, #8a3b2f, #8a6b1f, #8ad356, #8b9377, #8e9878, #9aa287, #9aa583, #a7b28d, #c3ccb0, #c9a227, #c9de4a, #c9e8a6, #cfd6bd, #e4ebd4, #e4eed0, #e6ebd7, #eaf0da, #eaf3e0, #eef1e1, #eef2dc, #f2f4e4, #f4f5e2, #f4f8ea, #f6e5e0, #f6f0dc, #fbf8e3, #fbfaf0, #fff
```

### Typography
- **Display / brand:** Manrope (weights 500–800), tight tracking (`-.02em` to `-.035em`).
- **UI / body:** DM Sans (400–700), opsz variable font.
- Headlines: `clamp(...)` responsive Manrope; body ~15–18px DM Sans.
- Google Fonts import in `<helmet>`.

### Radii

```
5px, 7px 7px 0 0, 9px, 10px, 11px, 12px, 13px, 14px, 16px, 18px, 20px, 22px, 24px, 26px, 50%, 999px, 999px">
        <sc-for list="{{ groupTabs }}" as="g" hint-placeholder-count="3">
          <button onClick="{{ g.go }}" style="border:none
```

Common: `999px` (pills), `50%` (avatars/dots), `9–12px` (logo/nav items), `14–22px` (cards).

## Interaction model

### Routing
- Single component state: `screen` (string id). Getter falls back to `props.startScreen` or `"home".
- `set(screen)` / `go(id)` handlers wire all nav buttons via `onClick="{{ ... }}"`.
- Group derived from screen prefix: `u-*` → user, `a-*` → admin, else public.
- Boolean map `is.*` drives every `sc-if` (including nested wizard / payment status flags).

### Local UI state
| Key | Purpose |
|---|---|
| `step` | Registration wizard 1–5 |
| `ticket` | Selected ticket tier name |
| `day` | Schedule day index |
| `payMethod` | Checkout method id |
| `payStatus` | `processing` \| `success` \| `failed` |

### Template DSL → React mapping
- `<sc-if value="{{ expr }}">` → conditional render (`{cond && ...}` / routes).
- `<sc-for list="{{ arr }}" as="item">` → `.map`.
- `{{ path }}` interpolations → JSX expressions.
- `onClick="{{ handler }}"` → React `onClick`.
- `style-hover="..."` → CSS `:hover` or styled-components / CSS modules.
- `<image-slot>` → replace with `<img>` / Next `Image` + placeholder.
- Props: `showPrototypeNav`, `startScreen`, `showHeroCollage`, `accentColor`.

### Suggested React route map
```
Public:  /  /events  /events/:id  /speakers  /schedule
         /register  /checkout  /payment  /receipt
User:    /app  /app/ticket  /app/schedule  /app/network  /app/notifications  /app/certificates
Admin:   /admin  /admin/events  /admin/events/new  /admin/tickets
         /admin/attendees  /admin/check-in  /admin/schedule  /admin/timeline
         /admin/poster  /admin/comms  /admin/sponsors  /admin/payments  /admin/reports
```

## Extraction outputs

- `sections.json` — `screenId →` raw inner HTML of each major `sc-if`.
- Nested user/admin page sections are included alongside the `user` / `admin` shells.
- Template bindings (`{{ ... }}`, `sc-for`, `sc-if`) are preserved for downstream conversion.
