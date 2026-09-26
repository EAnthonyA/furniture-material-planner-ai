# Dirbtuvės — Furniture Material Planner

An owner-only furniture planning application for turning hand drawings into reviewed requirements, cutting layouts, and store-specific purchase lists.

## Current slice

The repository now has a Next.js App Router foundation, responsive Lithuanian project-setup screen, typed project/AI boundaries, an initial PostgreSQL schema, local Docker Compose database, worker entry point, and a health route. Persistence, authentication, image upload, catalog imports, and the optimizer are the next implementation slices.

## Run locally

1. Copy `.env.example` to `.env` and add API values only when they are needed.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`; health is available at `http://localhost:3000/api/health`.

This one command launches `postgres`, runs pending Prisma migrations, then starts `web` (Next.js) and `worker` (background processing). Project files are kept in named Docker volumes, so stopping containers does not discard the database or private storage. Use `docker compose down` to stop the stack; use `docker compose down -v` only when you deliberately want to erase local data.

Run `pnpm db:generate`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before merging changes. Prisma Client is generated into `src/generated/prisma` and is intentionally not committed.

## Design direction

The interface is an editorial workshop notebook: warm paper, walnut ink, and drafting grid lines. It preserves touch-size controls and rearranges its material selector between phone and larger screens.
