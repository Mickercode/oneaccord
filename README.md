# One Accord

Registration and check-in for Upper Room, built to the One Accord PRD. Attendees
scan our codes with their own phones, so a city is accounted for without buying a
single scanner.

_Concept, prepared to pitch to the Upper Room team at Dunsin Oyekan Ministries.
Not an official Upper Room asset._

## What is here

| Path                       | What it is                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `apps/api`                 | NestJS API, Prisma, BullMQ, the Socket.IO gateway. Every endpoint in the PRD.           |
| `apps/web`                 | The attendee app, Day theme: register, UR Pass, boarding scan, gate scan, walk-in lane. |
| `apps/team`                | Delegates and ushers, Night theme, installable, works with no signal.                   |
| `apps/admin`               | Setup and the live dashboard, Night theme.                                              |
| `packages/types`           | The contract the API and all three apps compile against.                                |
| `packages/ui`              | The design system as React: the date strip, the city tab, zone tags, status screens.    |
| `one-accord-design-system` | Tokens, logos and `BRAND.md`. The source of truth for how anything looks.               |
| `scripts/e2e.sh`           | A walk through the whole flow against a running API, from the flyer to the export.      |
| `Dockerfile`               | One image: the API and the three built apps it serves. What Railway runs.               |
| `.github/workflows`        | CI on every pull request, deploys from `staging` and `production`.                      |

## Running it

You need Node 20+, pnpm 9 and Docker.

```bash
pnpm install
docker compose up -d --wait          # Postgres on 55433, Redis on 6379
cp .env.example apps/api/.env
pnpm db:migrate                      # create the schema
pnpm db:seed                         # a pilot-sized Upper Room Lagos
pnpm dev                             # API on 3000, apps on 5173/5174/5175
```

Each app proxies `/api` and `/socket.io` to the API, so nothing is
cross-origin in development either.

| App       | Address                        | Who signs in                                                   |
| --------- | ------------------------------ | -------------------------------------------------------------- |
| Attendee  | http://localhost:5173          | Nobody. Attendees never need an account.                       |
| Team      | http://localhost:5174          | `tolu@oneaccord.example` (delegate), `usher@oneaccord.example` |
| Dashboard | http://localhost:5175          | `admin@oneaccord.example`                                      |
| API docs  | http://localhost:3000/api/docs | —                                                              |

Sign-in is by magic link. With `MAIL_PROVIDER=console` every email, link and pass
code is printed to the API log instead of being sent, so you can follow it
straight from the terminal.

The seed prints a real pass code to try. Open `/pass/UR-XXXX` on a phone-sized
window, then open a delegate's trip on another and scan the code between them.

### Notes that will save you an hour

- `.env` uses `127.0.0.1`, not `localhost`. On Windows `localhost` can resolve to
  IPv6 while Docker binds IPv4 only, and Prisma then cannot reach the database.
- Postgres is on **55433**, to stay out of the way of anything already on 5432.
- On Windows, stop the API before `prisma generate`: a running Node process holds
  the query engine DLL open and the build fails with `EPERM`.

## How the two mechanisms work

**The rotating boarding code (BD-1 to BD-4).** The delegate's screen asks for
`/trips/:id/boarding-code` and redraws every 30 seconds. The token is
`b:<tripId>:<window>` signed with the server secret, where the window is the
30-second slot it belongs to. On the way back in, the API accepts the current
window and the one before it, so a code is good for at most 60 seconds and a
screenshot shared in a group chat is worth nothing by the time it arrives. The
gate poster uses the same page with a fixed, signed gate token, checked against
the event's door hours instead, so it can be printed days ahead.

**One check-in per person per stage.** `CheckIn` is unique on
`(registration, stage)`. That single index is what makes a scan repeated five
times change nothing, what lets an usher tap "Confirm arrival" twice without
double counting, and what makes the delegate's offline queue safe to replay when
the signal returns. Nothing else in the system needs to know about retries.

## What is built

Every **Must** in the PRD, and every **Should**.

| Group             | Done                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Events and setup  | EV-1 … EV-7. Zones, pickup points, buses, trips, gates, team invites, copy a city, CSV import.                         |
| Registration      | RG-1 … RG-6. Trip assignment takes a Postgres advisory lock, so two people cannot take the same last seat.             |
| UR Pass and email | PS-1 … PS-5. Pass, device cookie, reminders, WhatsApp link.                                                            |
| Boarding          | BD-1 … BD-9, including check-in by name, walk-ins onto a bus, boarding a trip you did not book, and the offline queue. |
| Gate              | GT-1 … GT-5. One tap per trip, the poster, the walk-in lane, look-up.                                                  |
| Zones             | ZN-1 … ZN-3.                                                                                                           |
| Dashboard         | DB-1 … DB-4, live over WebSocket.                                                                                      |
| Messages          | MS-1, MS-2.                                                                                                            |

Beyond the list, attendees can have their details removed from the pass page, as
the Nigeria Data Protection Act requires. The personal fields go and the check-in
rows stay, so the city's attendance still adds up.

**Deliberately not built**, marked _Later_ in the PRD: wallet passes (PS-6), SMS
(PS-7), comparing events over time (DB-5). RG-5 closes a full pickup point and
offers the ones with seats left, but there is no waitlist.

## What has been verified

Run against Postgres 16 and Redis 7 on a real database, not mocks.

| Check            | Result                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck` | Clean across all six packages.                                         |
| `pnpm build`     | All four apps build, and the Dockerfile builds the lot into one image. |
| `pnpm test`      | 33 unit tests: token windows, forgery, expiry, pass-code alphabet.     |
| `pnpm test:e2e`  | 42 assertions through the whole flow, against one origin.              |

The end-to-end run covers registering, the pass email, the device cookie, the
rotating code, a double scan, an expired code, a forged code, check-in by name,
departure locking the trip, the usher's one tap, the poster refusing before the
doors open and working after, a walk-in, the live totals, the CSV export and the
deletion request. Reminder selection is verified separately against the database:
the right people, once each, with the claim row refusing a second send.

Measured attendee bundle: **240 KB raw, 76 KB over the wire** (12 KB CSS, 228 KB
JS, gzipped). The PRD asks for under 200 KB for registration and under 100 KB for
check-in. Compressed it clears both; uncompressed it does not, and React is
almost all of it. If the raw number is the one that matters to the Upper Room
team, aliasing Preact or hand-writing the check-in page would close the gap.

## Before a pilot

These are real gaps, not polish.

1. **Load test.** The PRD asks for 500 check-ins a second at twice the expected
   peak. Nothing here has been load-tested. Check-in is the module to test and to
   scale first.
2. **Rate limits are per instance.** `ThrottlerModule` keeps its counters in
   memory, so limits multiply by the number of API instances. Move it to the
   Redis storage adapter, and put Cloudflare in front — which also puts the
   apps' static assets on a CDN edge, worth having for a 3G crowd in Lagos.
3. **The sending domain.** Set up a dedicated domain with SPF, DKIM and DMARC and
   warm it before the first flyer drops, or the passes land in spam.
4. **Accessibility.** Built to the rules (48px targets, labels, live regions,
   contrast from the tokens) but not audited against WCAG 2.2 AA.
5. **The status page and on-call rota** the PRD asks for. `/health` reports the
   database and Redis; nothing watches it yet.
6. **Agree the targets** in the PRD's measurement table with the Upper Room team.
   They are proposals.

## One origin

In production a single process serves everything:

```
/            the attendee app
/team        delegates and ushers
/admin       setup and the live dashboard
/api/*       the API
/health      what Railway and the load balancer read
```

That is not just tidiness. Check-in hinges on a cookie the API sets when an
attendee opens their UR Pass email being sent back when they later scan the
delegate's rotating code. On one origin that cookie is `SameSite=Lax` and
simply works: no CORS allowance, no `COOKIE_DOMAIN`, nothing to misconfigure in
a car park on the day. `PUBLIC_URL` is the only address to set.

Run that arrangement locally with `pnpm build`, then:

```bash
SERVE_APPS=true PUBLIC_URL=http://127.0.0.1:3000 node apps/api/dist/main.js
```

## Branches and deploys

`main` is the integration branch; `staging` and `production` deploy to Railway
when something is merged into them. Feature branches pull-request into `main`,
and the **Promote** workflow opens the promotion PRs. The whole arrangement,
including how to wire up a Railway environment, is in
[CONTRIBUTING.md](CONTRIBUTING.md).

Give the service `DATABASE_URL`, `REDIS_URL`, `APP_SECRET`, `PUBLIC_URL` and the
mail settings. The container runs `prisma migrate deploy` as it starts, so
merging a migration is what applies it.

Run more than one instance freely: the Socket.IO Redis adapter means a check-in
on one shows on every dashboard, and BullMQ spreads the mail across whichever
instances are up.
