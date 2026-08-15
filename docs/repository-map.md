# Repository map

This document describes the repository boundaries for contributors. It is a
navigation aid, not a replacement for the architecture, database, operations,
or project-control documentation.

## Application structure

- `src/app` contains Next.js App Router pages, layouts, route handlers, and
  route-level actions.
- `src/components` contains shared presentation components and UI primitives.
- `src/features` contains shared schemas, constants, normalization, and
  domain-oriented helpers.
- `src/server` contains server-only business logic, authorization, and
  persistence boundaries.
- `src/generated/prisma` is the ignored Prisma client generated from the schema.
- `src/lib` contains shared utilities and environment helpers.
- `src/test` contains shared Vitest setup, aliases, and test helpers.

## Data, automation, and tests

- `prisma` contains the schema, checked-in migrations, and development
  provisioning utilities.
- `scripts` contains CI, E2E, operations, preview, and production automation.
- `tests/e2e` contains Playwright browser journeys and their test environment.
- `public` contains static application assets.
- `.github/workflows` contains GitHub Actions CI configuration.

## Documentation

- `docs` contains stable architecture, authentication, and database guides.
- `docs/operations` contains operational and deployment runbooks.
- `docs/roadmap` contains the canonical roadmap.
- `docs/project3` preserves project-control history, decisions, and verification
  evidence.

## Framework-sensitive paths

Do not casually rename or move these paths. They are resolved by framework
conventions, runtime configuration, generated-code settings, or test tooling:

- `src/app`
- `src/proxy.ts`
- `src/auth.ts`
- `src/auth.config.ts`
- `prisma/schema.prisma`
- `prisma/migrations`
- `src/generated/prisma`
- `tests/e2e`
- root framework and tool configuration files, including `next.config.ts`,
  `tsconfig.json`, `prisma.config.ts`, `vitest.config.ts`,
  `playwright.config.ts`, and `vercel.json`
