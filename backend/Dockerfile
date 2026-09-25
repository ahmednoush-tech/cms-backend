# ============================================================
# Backend Dockerfile — multi-stage build
#
# IMPORTANT: openssl is installed explicitly in the runtime stage
# below for TWO reasons, not one — easy to miss if this image is
# ever "slimmed down" further:
#   1. Prisma's query engine binary needs it (the common reason
#      people know about).
#   2. ZatcaCryptoService.generateCsr() (see that file's own
#      comment) shells out to the real `openssl` CLI to build
#      ZATCA CSRs — this was a deliberate choice made after an
#      earlier attempt using a pure-JS library (node-forge) turned
#      out to have unverifiable, broken logic. Removing openssl
#      from this image breaks ZATCA onboarding at runtime, not at
#      build time, with a generic "spawn openssl ENOENT" error.
# ============================================================

FROM node:20-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json .npmrc ./
# npm install, not npm ci: this project has no committed
# package-lock.json, and npm ci REQUIRES an existing lockfile to
# work at all — it fails immediately otherwise. npm install
# generates the lockfile on this first run instead. Once a real
# package-lock.json exists and is committed, switching back to
# npm ci here is the better long-term choice (stricter, faster,
# fully reproducible builds).
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build
# Compiles prisma/seed.ts (and scripts/*.ts) to plain JS ahead of
# time, using the SAME dedicated tsconfig.scripts.json ts-node uses
# in development — because the runtime stage below installs
# PRODUCTION dependencies only (`npm install --omit=dev`), so
# ts-node (a devDependency) is never actually present there. A
# real container run confirmed this: `npx prisma db seed` failed
# with "spawn ts-node ENOENT" since ts-node genuinely does not
# exist in that image. Running the pre-compiled JS with plain
# `node` instead needs nothing beyond what's already installed.
RUN npx tsc -p tsconfig.scripts.json

# ------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json .npmrc ./
RUN npm install --omit=dev

COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-scripts ./dist-scripts

EXPOSE 3000

# Applies every pending migration (tracked via Prisma's own
# _prisma_migrations table, so this is safe to run on every
# container start — already-applied migrations are skipped, never
# re-run) before the app starts serving traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
