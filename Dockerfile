# One Accord, as one image: the API and the three apps it serves.
#
# Debian slim rather than Alpine: Prisma's query engine wants glibc and
# OpenSSL, and musl builds are a recurring source of surprises on a day when
# the gate is already busy.
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- dependencies -----------------------------------------------------------
# Only the manifests, so a change to source code does not reinstall the world.
# Scripts are skipped here because the Prisma schema has not been copied yet;
# every stage that needs a client generates one explicitly.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/team/package.json ./apps/team/
COPY apps/admin/package.json ./apps/admin/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY one-accord-design-system ./one-accord-design-system
COPY packages ./packages
COPY apps ./apps
# The apps call /api on their own origin, so nothing about the deploy address
# is baked into them at build time.
RUN pnpm --filter @oa/types run build \
  && pnpm --filter @oa/api run build \
  && pnpm --filter @oa/web run build \
  && pnpm --filter @oa/team run build \
  && pnpm --filter @oa/admin run build

# ---- production dependencies ------------------------------------------------
# Only what the API needs at runtime. The apps are plain files by now.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts \
      --filter @oa/api... --filter @oa/types

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

# packages/types has no runtime dependencies of its own, so --prod leaves it
# without a node_modules at all. Only the root and the API have one.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

# The three apps, served from this same process at /, /team and /admin.
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/team/dist ./apps/team/dist
COPY --from=build /app/apps/admin/dist ./apps/admin/dist

# The schema and migrations travel with the image: the container runs
# `prisma migrate deploy` on the way up.
COPY apps/api/prisma ./apps/api/prisma

# Generate against this image's own platform, not the build stage's.
RUN pnpm --filter @oa/api exec prisma generate

USER node
EXPOSE 3000

# Railway and the load balancer both read /health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api
CMD ["pnpm", "run", "start:prod"]
