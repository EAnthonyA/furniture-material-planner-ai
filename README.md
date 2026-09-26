# Dirbtuvės — Furniture Material Planner

An owner-only furniture planning application for turning hand drawings into reviewed requirements, cutting layouts, and store-specific purchase lists.

## Current slice

The repository now has a Next.js App Router foundation, responsive Lithuanian project-setup screen, typed project/AI boundaries, an initial PostgreSQL schema, local Docker Compose database, worker entry point, and a health route. Persistence, authentication, image upload, catalog imports, and the optimizer are the next implementation slices.

## Run locally

1. Copy `.env.example` to `.env` and add API values only when they are needed.
2. For active development, run `make up`.
3. Open `http://localhost:3000`; health is available at `http://localhost:3000/api/health`.

The development command bind-mounts the source and runs Next.js in development mode, so web changes reload without rebuilding containers. The worker also restarts when its source changes. Rebuild only after dependency, Dockerfile, or Prisma schema/migration changes: run `make rebuild`. Project data and private uploads remain in named volumes, so stopping containers does not discard them. Use `make down` to stop the stack; use `docker compose down -v` only when you deliberately want to erase local data.

Use `docker compose up --build` when you specifically want to run the production-style standalone image.

Run `pnpm db:generate`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before merging changes. Prisma Client is generated into `src/generated/prisma` and is intentionally not committed.

## Analysis language and material context

The worker sends the project's configured material groups, including thickness in millimetres, with the drawings. Gemini analyzes in English and treats configured thickness as owner input; existing material group names remain exact identifiers. A separate Gemini request translates only display text into Lithuanian. The English draft remains the canonical `AnalysisRun.output`; Lithuanian text is stored alongside it in `output.translations.lt`. Measurements, provenance, quantities and question IDs never pass through the translator.

Analysis is complete after both requests succeed. If translation fails, the English draft is retained for diagnostics and the run is marked failed. Earlier runs without translations must be analyzed again to include material context and Lithuanian display text. This uses the existing JSON column and requires no database migration or new environment variables. After updating, rebuild both services with `docker compose up -d --build --no-deps web worker`.

## Design direction

The interface is an editorial workshop notebook: warm paper, walnut ink, and drafting grid lines. It preserves touch-size controls and rearranges its material selector between phone and larger screens.
