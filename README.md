# Dirbtuvės — Furniture Material Planner

An owner-only furniture planning application for turning hand drawings into reviewed requirements, cutting layouts, and store-specific purchase lists. The complete product plan is in [plan.md](./plan.md).

## Current slice

The repository now has a Next.js App Router foundation, responsive Lithuanian project-setup screen, typed project/AI boundaries, an initial PostgreSQL schema, local Docker Compose database, worker entry point, and a health route. Persistence, authentication, image upload, catalog imports, and the optimizer are the next implementation slices.

## Run locally

1. Copy `.env.example` to `.env` and edit values if needed.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Install dependencies: `pnpm install`.
4. Start the application: `pnpm dev`.
5. Open `http://localhost:3000`; health is available at `http://localhost:3000/api/health`.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before merging changes. Prisma build scripts are initially blocked by pnpm's safety policy; approve only the Prisma packages before running `pnpm db:generate` or migrations.

## Design direction

The interface is an editorial workshop notebook: warm paper, walnut ink, and drafting grid lines. It preserves touch-size controls and rearranges its material selector between phone and larger screens.
