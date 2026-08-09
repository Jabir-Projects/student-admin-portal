# Student Administration Portal

A production-oriented university portal connecting students with administration.
It includes public registration, student self-service, capability-authorized
STAFF operations, Registry/Finance imports, documents, notifications, and audit
workflows. See [the Monday demo and handoff guide](docs/operations/monday-demo-handoff.md)
for the verified demonstration setup and deferred institutional dependencies.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when environment values are needed. Never
commit `.env.local` or real credentials.

`DATABASE_URL` must be the pooled Neon connection used by the application.
`DIRECT_URL` must be the direct Neon connection used by Prisma CLI migrations.
Both Prisma configuration and database runtime modules explicitly load
`.env.local` without logging either value.

## Database development

```bash
npm run db:format
npm run db:validate
npm run db:generate
npx prisma migrate dev
npm run db:seed
npm run db:status
```

Use checked-in Prisma migrations for schema changes. Production environments
apply them with `npm run db:deploy`; `prisma db push` and destructive
database reset commands are not production migration strategies.

The Production database, secrets, migration, deployment, and recovery procedure
is documented in [`docs/operations/production-readiness.md`](docs/operations/production-readiness.md).

## Quality checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for boundaries, security
requirements, and the planned feature structure. See
[`docs/database.md`](docs/database.md) for the database model and operating rules.
Authentication, registration, and manual approval are documented in
[`docs/authentication.md`](docs/authentication.md). Public registrations create
pending student accounts; submitted Student Numbers are not institutionally
verified in Phase 3.
