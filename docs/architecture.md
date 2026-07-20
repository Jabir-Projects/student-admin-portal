# Architecture

## Scope

The Student Administration Portal is a single Next.js App Router application.
Phase 1 contains only the frontend and engineering foundation. Database,
authentication, authorization, and business workflows begin in later phases.

## Runtime boundaries

- Server Components are the default for routes and read-only presentation.
- Client Components are limited to browser interaction, such as error recovery.
- Server Actions will own suitable authenticated mutations.
- Route Handlers will be reserved for integration boundaries such as exports.
- Business rules belong in feature services, not page components.
- Server-only data access will live under `src/server` and must never be imported
  by Client Components.

## Source structure

```text
src/
  app/          Routes, layouts, and route-level boundaries
  components/   Shared presentation and shadcn/ui primitives
  features/     Feature-owned schemas, services, and components
  lib/          Framework-agnostic utilities and environment validation
  server/       Authentication, authorization, and persistence boundaries
  test/         Shared test setup and fixtures
tests/e2e/      Browser-level user journeys
```

Feature folders will be introduced only when their phase starts. Planned
features include authentication, student profiles, requests, notifications,
categories, administration, exports, and audit logging.

## Security invariants

- Authentication and role checks execute on the server.
- Every student-owned resource requires object-level authorization.
- Administrator accounts are never created through public registration.
- Private administrator notes are never serialized into student responses.
- All untrusted input is validated with Zod at the server boundary.
- Status changes use an allow-listed state machine and create immutable history.
- Secrets remain server-only and are validated at startup without logging values.
- Mutations must create appropriate audit records and return safe errors.

## Request lifecycle

Normal transitions are `SUBMITTED -> UNDER_REVIEW`, `SUBMITTED -> CANCELLED`,
`UNDER_REVIEW -> APPROVED`, `UNDER_REVIEW -> REJECTED`, `APPROVED -> READY`, and
`READY -> COMPLETED`. Students may cancel only `SUBMITTED` requests.

## Data and deployment

Later phases will use PostgreSQL on Neon through Prisma migrations, Auth.js for
sessions, and Vercel for deployment. Production schema changes must use checked-in
Prisma migrations; `prisma db push` is not a production migration strategy.

## Verification

Vitest covers isolated logic and components. Playwright covers critical browser
journeys. ESLint, strict TypeScript, Prettier, tests, and `next build` are required
before a phase is considered complete.
