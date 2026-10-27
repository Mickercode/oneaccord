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

## Wiring up a Render environment

Once per environment, for `staging` and again for `production`.

1. **Create the Postgres first.** New -> PostgreSQL, in the region you will
   use. The container runs `prisma migrate deploy` before it serves, so with
   no reachable database it crash-loops rather than starting empty.

   Pick the region deliberately: it cannot be changed later without recreating
   the service, and the database must share it. Frankfurt is the usual choice
   for a Lagos crowd, because West African subsea cables run north to Europe
   and a European region often beats a South African one. Measure before a city.

2. **Create the web service** from this repo, Docker runtime, root directory
   empty, branch `staging` or `production`. Not the free instance: it spins
   down when idle, which stops the mail outbox and the reminder sweep, so
   passes stop sending.

3. **Set Auto-Deploy to No.** The workflow drives deploys instead, so nothing
   ships until CI is green and a merge into `production` still waits for the
   approval on the GitHub environment. Render's own auto-deploy would bypass
   both.

4. **Set the service's variables:**

   | Variable                           | Value                                               |
   | ---------------------------------- | --------------------------------------------------- |
   | `NODE_ENV`                         | `production`                                        |
   | `DATABASE_URL`                     | the **Internal** Database URL, not the External one |
   | `APP_SECRET`                       | 32 random bytes, different per environment          |
   | `API_URL`                          | the service's own address, ending `/api`            |
   | `WEB_URL`, `TEAM_URL`, `ADMIN_URL` | the three Vercel addresses                          |
   | `MAIL_PROVIDER`                    | `resend` or `postmark`                              |
   | `MAIL_API_KEY`, `MAIL_FROM`        | from the mail provider                              |

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   There is no `REDIS_URL` and no `PORT`: nothing reads the first, and Render
   sets the second.

5. **Copy the Deploy Hook** from the service's settings.

6. In GitHub, under **Settings -> Environments**, make an environment with the
   matching name and add:
   - secret `RENDER_DEPLOY_HOOK` — the hook from step 5
   - variable `API_BASE_URL` — the service's address, no trailing slash

7. On `production`, add yourself under **Required reviewers**. That is the
   manual gate: a merge into `production` then waits for an approval before it
   deploys.

`APP_SECRET` signs boarding codes, gate tokens, UR Pass sessions and team
sessions. Changing it signs everyone out and invalidates every pass already on
a phone, so treat it as a release, not a tweak.

### How a deploy proves itself

`/health` reports the commit it is running, from `RENDER_GIT_COMMIT`. The
workflow asks Render for a deploy and then waits until the service answers
with that exact commit and `"ok":true`. Asking for a deploy and getting one
are different things, and a green tick that only means "the request was
accepted" is worse than no tick at all.

## What CI checks

| Job     | What it does                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `check` | Prettier, TypeScript across both packages, 33 unit tests.                                                                               |
| `e2e`   | Starts Postgres, Redis and the API, seeds a city, then walks 42 assertions from registration to the CSV export.                         |
| `image` | Builds the Dockerfile, which is what Render runs. On `main`, `staging` and `production` it publishes to `ghcr.io/mickercode/oneaccord`. |

All three must pass before a pull request can merge.
