# Working on One Accord

## Branches

Three branches live for ever. Everything else is a feature branch that exists
until its pull request is merged.

```
feat/rotating-code ─┐
fix/zone-fill ──────┼─ PR ─> main        CI: format, types, tests, end to end, image
                    ┘        │
                             └─ PR ─> staging     → deploys to staging
                                        │
                                        └─ PR ─> production  → deploys to production
```

| Branch       | What it is                                                      | What happens on a push                    |
| ------------ | --------------------------------------------------------------- | ----------------------------------------- |
| `main`       | The default branch and the integration line. Always releasable. | CI, and an image published to GHCR.       |
| `staging`    | What the team is testing on.                                    | CI, then a deploy to the staging service. |
| `production` | What a city is actually using.                                  | CI, then a deploy to production.          |

### Naming a feature branch

`feat/`, `fix/`, `chore/`, `docs/` or `refactor/`, then a few words with
hyphens. Where it maps to a PRD requirement, say so: `feat/bd4-code-expiry`.

### Promoting

Run the **Promote** workflow under Actions and pick `staging` or `production`.
It lists what would go out and gives you a link that opens the pull request
with the right base and head. Merging that pull request is what deploys.
Nothing is ever pushed straight at `staging` or `production`.

The workflow hands you a link rather than opening the PR itself, because
opening it would mean turning on "Allow GitHub Actions to create and approve
pull requests" for the whole repository. One click is cheaper than that.

A hotfix still goes through `main`: branch from `main`, PR into `main`, then
promote twice. It takes two extra clicks and keeps the three branches from
drifting, which matters more the week before a gathering.

## Day to day

```bash
pnpm install
docker compose up -d --wait     # Postgres on 55433, Redis on 6379
cp .env.example apps/api/.env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

|              | Where                     |                                                     |
| ------------ | ------------------------- | --------------------------------------------------- |
| Attendee app | http://localhost:5173     | Nobody signs in.                                    |
| Team app     | http://localhost:5174     | `tolu@oneaccord.example`, `usher@oneaccord.example` |
| Dashboard    | http://localhost:5175     | `admin@oneaccord.example`                           |
| API          | http://localhost:3000/api | docs at `/api/docs`                                 |

The apps live in their own repository and proxy `/api` here while you work.

Before you open a pull request:

```bash
pnpm format        # prettier, in place
pnpm typecheck
pnpm test          # unit tests
pnpm db:reset && pnpm db:seed
pnpm test:e2e      # the whole flow against your local database
```

The walk takes the last seats on a bus and departs it, so it wants a freshly
seeded database. Run it twice without reseeding and it stops with a note
saying so.

`pnpm test:e2e` needs the API running with `MAIL_PROVIDER=console` and its
output going to a file, because that is where it reads the magic link from:

```bash
export API_LOG=/tmp/one-accord-api.log
pnpm --filter @oa/api run build
node apps/api/dist/main.js > "$API_LOG" 2>&1 &
pnpm test:e2e
```

### A migration

```bash
pnpm db:migrate --name what_it_does
```

Commit the generated folder under `apps/api/prisma/migrations`. The container
runs `prisma migrate deploy` as it starts, so merging the PR is what applies it.
Write migrations that an older instance can survive for a minute or two: add a
column before you read it, and drop one in a later release, not the same one.

## Wiring up a Railway environment

Once per environment, for `staging` and again for `production`.

1. In Railway, create a project with a **Postgres** plugin, a **Redis** plugin
   and an empty service named `one-accord-api`. Point the service at this repo;
   it will pick up the `Dockerfile` and `railway.json`. One service serves the
   API and all three apps.
2. Set the service's variables:

   | Variable                           | Value                                      |
   | ---------------------------------- | ------------------------------------------ |
   | `NODE_ENV`                         | `production`                               |
   | `DATABASE_URL`                     | `${{Postgres.DATABASE_URL}}`               |
   | `REDIS_URL`                        | `${{Redis.REDIS_URL}}`                     |
   | `APP_SECRET`                       | 32 random bytes, different per environment |
   | `WEB_URL`, `TEAM_URL`, `ADMIN_URL` | the three Vercel addresses                 |
   | `MAIL_PROVIDER`                    | `resend` or `postmark`                     |
   | `MAIL_API_KEY`, `MAIL_FROM`        | from the mail provider                     |

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   The three app addresses are used for the sign-in redirect, the links in
   emails, and the CORS allowlist. Because the apps are on another site, the UR
   Pass cookie cannot reach this API and the apps carry a bearer token instead.
   Put everything on one registrable domain and set `COOKIE_DOMAIN`, and the
   cookie takes over again.

3. In Railway, create a **project token** for that environment.
4. In GitHub, under **Settings → Environments**, make an environment with the
   matching name and add:
   - secret `RAILWAY_TOKEN` — the project token from step 3
   - variable `API_BASE_URL` — the service's public URL, used for the smoke test
     and shown on the deployment
5. On `production`, add yourself under **Required reviewers**. That is the
   manual gate: a merge into `production` then waits for an approval before it
   deploys.

`APP_SECRET` signs boarding codes, gate tokens, UR Pass cookies and team
sessions. Changing it signs everyone out and invalidates every pass cookie, so
treat it as a release, not a tweak.

## What CI checks

| Job     | What it does                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `check` | Prettier, TypeScript across both packages, 33 unit tests.                                                                                      |
| `e2e`   | Starts Postgres, Redis and the API, seeds a city, then walks 42 assertions from registration to the CSV export.                                |
| `image` | Builds the Dockerfile, which is what Railway runs. On `main`, `staging` and `production` it publishes to `ghcr.io/truvoid-tech/one-accord-be`. |

All three must pass before a pull request can merge.
