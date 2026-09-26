# Repository Guidelines

## Project Structure & Module Organization

This Next.js App Router app plans furniture materials. Keep routes and actions in `src/app/`, reusable UI in `src/components/`, and business boundaries in `src/lib/`: `domain/`, `ai/`, `db/`, and `storage/`. The worker starts at `src/worker/index.ts`. Prisma schema and migrations live in `prisma/`; do not commit generated `src/generated/prisma/` code.

## Build, Test, and Development Commands

Use pnpm (the repository pins `pnpm@12.6.0`).

- `docker compose up --build` starts PostgreSQL, applies migrations, and runs the web and worker services.
- `pnpm dev` runs the Next.js app locally; `pnpm worker` runs only the worker.
- `pnpm db:generate` regenerates Prisma Client after schema changes.
- `pnpm db:migrate` creates and applies a development migration.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` check linting, strict TypeScript, tests, and production builds. Run all four before merging.

## Coding Style & Naming Conventions

Write strict TypeScript with the `@/` alias for `src/` imports. Follow existing formatting: two-space indentation, semicolons, double-quoted strings, and trailing commas. Use `PascalCase` for React components and exported types, `camelCase` for functions and values, and kebab-case filenames such as `project-setup.tsx`. Keep Zod validation at input boundaries and preserve Lithuanian UI copy and accessible labels.

Prioritize scanability in functions. Separate logical phases with blank lines: loading data, guard clauses, input validation, transformations, side effects, and the final return. Keep related statements together, but do not compress a long workflow into one uninterrupted block; extract a well-named helper when a phase needs its own explanation.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`, executed by `tsx`. Name tests `*.test.ts` next to the module they cover, such as `src/lib/domain/project.test.ts`, and describe observable behavior. Add validation, domain-transformation, and error-case tests whenever behavior changes. No coverage threshold is configured; maintain meaningful coverage.

## Database, Configuration & Security

Copy `.env.example` to `.env`; never commit it or credentials. Keep `GEMINI_API_KEY` server-only—do not expose it with a `NEXT_PUBLIC_` prefix. Make schema changes through Prisma migrations and include the generated migration SQL. Do not use `docker compose down -v` unless deliberately resetting local database and private-storage volumes.

## Commit & Pull Request Guidelines

The current history uses short, imperative summaries (for example, `Initial furniture planner foundation`). Keep commits focused and similarly phrased. PRs should explain the user-facing or data-model change, link related issues when available, list verification commands, and include screenshots for UI changes. Call out migrations, new environment variables, and worker behavior explicitly.
