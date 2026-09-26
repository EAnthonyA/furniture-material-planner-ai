# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS builder
COPY next.config.ts next-env.d.ts tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN export DATABASE_URL="postgresql://planner:planner@postgres:5432/furniture_planner?schema=public" \
  && pnpm db:generate \
  && pnpm build

# Next's standalone build includes only the files needed to serve the web app.
FROM base AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

# The worker intentionally keeps development dependencies: tsx runs its small,
# TypeScript entry point directly until the job handlers become substantial.
FROM builder AS worker
ENV NODE_ENV=production
CMD ["./node_modules/.bin/tsx", "src/worker/index.ts"]
