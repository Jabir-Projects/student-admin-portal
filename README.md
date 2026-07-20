# Student Administration Portal

A production-oriented university portal connecting students with administration.
Phase 2 adds the Neon PostgreSQL and Prisma database foundation. Authentication,
student workflows, and administrator workflows remain intentionally unimplemented.

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
apply them with `npx prisma migrate deploy`; `prisma db push` and destructive
database reset commands are not production migration strategies.

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
